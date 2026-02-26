"""Plane API integration service.

Fetches workspace members, projects, cycles, and issues from the Plane API.
Implements Redis caching with PostgreSQL snapshot fallback.
"""

import asyncio
import logging
from datetime import date, datetime, timezone

import httpx
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.team_member import TeamMember
from app.models.plane_snapshot import PlaneMetricsSnapshot
from app.models.project_status import ProjectStatusHistory
from app.models.cycle_snapshot import CycleSnapshot
from app.redis_client import cache_get, cache_set
from app.schemas.plane import (
    CycleAnalysisResponse,
    CycleInfo,
    CyclesResponse,
    MemberCyclePerformance,
    ProjectInfo,
    ProjectsResponse,
    TeamMemberMetrics,
    TeamMetricsResponse,
)

logger = logging.getLogger(__name__)

CACHE_KEY_TEAM_METRICS = "plane:team_metrics"
CACHE_KEY_PROJECTS = "plane:projects"
CACHE_KEY_CYCLES = "plane:cycles"
CACHE_KEY_CYCLE_ANALYSIS = "plane:cycle:{cycle_id}:analysis"

# Plane API pagination defaults
_PAGE_SIZE = 100
_REQUEST_TIMEOUT = 30.0
# Delay between paginated requests to avoid Plane 429 rate-limits
_PAGE_DELAY = 0.3


class PlaneAPIError(Exception):
    """Raised when the Plane API returns an unexpected response."""


class PlaneService:
    """Handles all interaction with the Plane REST API."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._base_url = settings.plane_base_url.rstrip("/")
        self._workspace = settings.plane_workspace_slug
        self._headers = {
            "X-API-Key": settings.plane_api_token,
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Low-level HTTP helpers
    # ------------------------------------------------------------------

    async def _get(self, path: str) -> dict | list:
        """Perform an authenticated GET against the Plane API.

        Handles pagination automatically when the response contains a
        ``next_page_results`` flag.
        """
        url = f"{self._base_url}{path}"
        all_results: list = []
        page = 1

        async with httpx.AsyncClient(
            headers=self._headers, timeout=_REQUEST_TIMEOUT
        ) as client:
            while True:
                separator = "&" if "?" in url else "?"
                paginated_url = f"{url}{separator}per_page={_PAGE_SIZE}&page={page}"

                response = await client.get(paginated_url)
                if response.status_code != 200:
                    raise PlaneAPIError(
                        f"Plane API returned {response.status_code} for {path}"
                    )

                data = response.json()

                # Plane wraps paginated responses in {"results": [...], ...}
                if isinstance(data, dict) and "results" in data:
                    all_results.extend(data["results"])
                    if data.get("next_page_results", False):
                        page += 1
                        await asyncio.sleep(_PAGE_DELAY)
                        continue
                    return all_results

                # Non-paginated response (plain list or dict)
                if isinstance(data, list):
                    return data
                return data

    def _workspace_path(self, suffix: str = "") -> str:
        return f"/api/v1/workspaces/{self._workspace}{suffix}"

    def _project_path(self, project_id: str, suffix: str = "") -> str:
        return self._workspace_path(f"/projects/{project_id}{suffix}")

    # ------------------------------------------------------------------
    # Public API methods
    # ------------------------------------------------------------------

    async def get_team_metrics(self) -> TeamMetricsResponse:
        """Fetch aggregated per-member metrics across all projects.

        Strategy:
        1. Check Redis cache.
        2. On miss, fetch from Plane API, compute metrics, cache, snapshot.
        3. On API error, fall back to the latest PostgreSQL snapshot.
        """
        cached = await cache_get(CACHE_KEY_TEAM_METRICS)
        if cached is not None:
            return TeamMetricsResponse(**cached, is_cached=True)

        try:
            return await self._fetch_team_metrics_from_api()
        except Exception as exc:
            logger.warning("Plane API error fetching team metrics: %s", exc)
            return await self._team_metrics_from_snapshot()

    async def get_projects(self) -> ProjectsResponse:
        """Fetch projects with dev/support classification and traffic-light status."""
        cached = await cache_get(CACHE_KEY_PROJECTS)
        if cached is not None:
            return ProjectsResponse(**cached, is_cached=True)

        try:
            return await self._fetch_projects_from_api()
        except Exception as exc:
            logger.warning("Plane API error fetching projects: %s", exc)
            return await self._projects_from_snapshot()

    async def get_cycles(self) -> CyclesResponse:
        """Fetch cycles from all projects with aggregated metrics."""
        cached = await cache_get(CACHE_KEY_CYCLES)
        if cached is not None:
            return CyclesResponse(**cached, is_cached=True)

        try:
            return await self._fetch_cycles_from_api()
        except Exception as exc:
            logger.warning("Plane API error fetching cycles: %s", exc)
            return await self._cycles_from_snapshot()

    async def get_cycle_analysis(self, cycle_id: str) -> CycleAnalysisResponse:
        """Detailed per-member analysis for a specific cycle."""
        cache_key = CACHE_KEY_CYCLE_ANALYSIS.format(cycle_id=cycle_id)
        cached = await cache_get(cache_key)
        if cached is not None:
            return CycleAnalysisResponse(**cached, is_cached=True)

        try:
            return await self._fetch_cycle_analysis_from_api(cycle_id)
        except Exception as exc:
            logger.warning(
                "Plane API error fetching cycle analysis for %s: %s",
                cycle_id,
                exc,
            )
            return await self._cycle_analysis_from_snapshot(cycle_id)

    # ------------------------------------------------------------------
    # API fetch + compute helpers
    # ------------------------------------------------------------------

    async def _fetch_team_metrics_from_api(self) -> TeamMetricsResponse:
        members_raw = await self._get(self._workspace_path("/members/"))
        if isinstance(members_raw, dict):
            members_raw = members_raw.get("results", [])

        projects_raw = await self._get(self._workspace_path("/projects/"))
        if isinstance(projects_raw, dict):
            projects_raw = projects_raw.get("results", [])

        # Build a map of member_id -> aggregated metrics
        member_map: dict[str, dict] = {}
        for m in members_raw:
            mid = str(m.get("member", {}).get("id", m.get("id", "")))
            member_info = m.get("member", m)
            display = (
                member_info.get("display_name")
                or member_info.get("first_name", "")
            )
            member_map[mid] = {
                "member_id": mid,
                "name": display,
                "avatar_url": member_info.get("avatar", None),
                "story_points_completed": 0.0,
                "tasks_completed": 0,
                "tasks_assigned": 0,
                "priority_sum": 0.0,
                "priority_count": 0,
            }

        # Iterate over projects to collect issue-level data
        for proj in projects_raw:
            pid = str(proj["id"])
            states = await self._get_states_map(pid)
            done_state_ids = {
                sid
                for sid, sdata in states.items()
                if sdata.get("group") in ("completed", "done")
            }

            issues = await self._get(self._project_path(pid, "/issues/"))
            if isinstance(issues, dict):
                issues = issues.get("results", [])

            for issue in issues:
                assignees = issue.get("assignees", [])
                estimate = _safe_float(issue.get("estimate_point"))
                priority = _priority_to_number(issue.get("priority"))
                state_id = str(issue.get("state", ""))
                is_done = state_id in done_state_ids

                for assignee_id in assignees:
                    aid = str(assignee_id)
                    if aid not in member_map:
                        continue
                    entry = member_map[aid]
                    entry["tasks_assigned"] += 1
                    if is_done:
                        entry["tasks_completed"] += 1
                        entry["story_points_completed"] += estimate
                    if priority > 0:
                        entry["priority_sum"] += priority
                        entry["priority_count"] += 1

        # Compute totals and relative effort
        total_points = sum(
            m["story_points_completed"] for m in member_map.values()
        )
        total_tasks = sum(m["tasks_completed"] for m in member_map.values())

        members_out: list[TeamMemberMetrics] = []
        for m in member_map.values():
            priority_avg = (
                m["priority_sum"] / m["priority_count"]
                if m["priority_count"] > 0
                else 0.0
            )
            relative = (
                (m["story_points_completed"] / total_points * 100)
                if total_points > 0
                else 0.0
            )
            members_out.append(
                TeamMemberMetrics(
                    member_id=m["member_id"],
                    name=m["name"],
                    avatar_url=m["avatar_url"],
                    story_points_completed=m["story_points_completed"],
                    tasks_completed=m["tasks_completed"],
                    tasks_assigned=m["tasks_assigned"],
                    priority_avg=round(priority_avg, 2),
                    relative_effort=round(relative, 2),
                )
            )

        now = _utcnow()
        result = TeamMetricsResponse(
            members=members_out,
            total_story_points=total_points,
            total_tasks_completed=total_tasks,
            last_updated=now,
            is_cached=False,
        )

        # Cache and snapshot
        await cache_set(
            CACHE_KEY_TEAM_METRICS,
            result.model_dump(mode="json"),
            settings.cache_ttl,
        )
        await self._save_team_metrics_snapshot(members_out)

        return result

    async def _fetch_projects_from_api(self) -> ProjectsResponse:
        projects_raw = await self._get(self._workspace_path("/projects/"))
        if isinstance(projects_raw, dict):
            projects_raw = projects_raw.get("results", [])

        projects_out: list[ProjectInfo] = []
        for proj in projects_raw:
            pid = str(proj["id"])
            pname = proj.get("name", "")

            # Classify: check modules for "intake" / "soporte"
            project_type = await self._classify_project(pid)

            # Issues for progress and status
            issues = await self._get(self._project_path(pid, "/issues/"))
            if isinstance(issues, dict):
                issues = issues.get("results", [])

            states = await self._get_states_map(pid)
            done_ids = {
                sid
                for sid, s in states.items()
                if s.get("group") in ("completed", "done")
            }

            total = len(issues)
            completed = sum(
                1 for i in issues if str(i.get("state", "")) in done_ids
            )
            progress = (completed / total * 100) if total > 0 else 0.0

            status = _traffic_light(progress, proj)
            member_count = proj.get("total_members", 0)

            start_str = proj.get("created_at", "")
            end_str = proj.get("updated_at", "")

            projects_out.append(
                ProjectInfo(
                    project_id=pid,
                    name=pname,
                    project_type=project_type,
                    status=status,
                    progress_pct=round(progress, 2),
                    start_date=_parse_date(start_str),
                    end_date=_parse_date(end_str),
                    member_count=member_count,
                )
            )

        now = _utcnow()
        result = ProjectsResponse(
            projects=projects_out, last_updated=now, is_cached=False
        )

        await cache_set(
            CACHE_KEY_PROJECTS,
            result.model_dump(mode="json"),
            settings.cache_ttl,
        )
        await self._save_projects_snapshot(projects_out)

        return result

    async def _fetch_cycles_from_api(self) -> CyclesResponse:
        projects_raw = await self._get(self._workspace_path("/projects/"))
        if isinstance(projects_raw, dict):
            projects_raw = projects_raw.get("results", [])

        cycles_out: list[CycleInfo] = []
        for proj in projects_raw:
            pid = str(proj["id"])
            pname = proj.get("name", "")

            cycles_raw = await self._get(self._project_path(pid, "/cycles/"))
            if isinstance(cycles_raw, dict):
                cycles_raw = cycles_raw.get("results", [])

            states = await self._get_states_map(pid)
            done_ids = {
                sid
                for sid, s in states.items()
                if s.get("group") in ("completed", "done")
            }

            for cyc in cycles_raw:
                cid = str(cyc["id"])
                cname = cyc.get("name", "")

                # Fetch cycle issues
                cycle_issues = await self._get(
                    self._project_path(pid, f"/cycles/{cid}/cycle-issues/")
                )
                if isinstance(cycle_issues, dict):
                    cycle_issues = cycle_issues.get("results", [])

                assigned = len(cycle_issues)
                completed = 0
                for ci in cycle_issues:
                    issue = ci.get("issue_detail", ci)
                    state_id = str(issue.get("state", ""))
                    if state_id in done_ids:
                        completed += 1

                rate = (completed / assigned * 100) if assigned > 0 else 0.0
                is_active = _is_cycle_active(cyc)

                cycles_out.append(
                    CycleInfo(
                        cycle_id=cid,
                        cycle_name=cname,
                        project_name=pname,
                        start_date=_parse_date(cyc.get("start_date")),
                        end_date=_parse_date(cyc.get("end_date")),
                        tasks_assigned=assigned,
                        tasks_completed=completed,
                        completion_rate=round(rate, 2),
                        is_active=is_active,
                    )
                )

        now = _utcnow()
        result = CyclesResponse(
            cycles=cycles_out, last_updated=now, is_cached=False
        )

        await cache_set(
            CACHE_KEY_CYCLES,
            result.model_dump(mode="json"),
            settings.cache_ttl,
        )
        await self._save_cycles_snapshot(cycles_out)

        return result

    async def _fetch_cycle_analysis_from_api(
        self, cycle_id: str
    ) -> CycleAnalysisResponse:
        """Build per-member analysis for a single cycle.

        Searches across all projects to find the cycle, then aggregates.
        """
        projects_raw = await self._get(self._workspace_path("/projects/"))
        if isinstance(projects_raw, dict):
            projects_raw = projects_raw.get("results", [])

        cycle_data: dict | None = None
        project_id: str | None = None

        for proj in projects_raw:
            pid = str(proj["id"])
            cycles_raw = await self._get(self._project_path(pid, "/cycles/"))
            if isinstance(cycles_raw, dict):
                cycles_raw = cycles_raw.get("results", [])
            for cyc in cycles_raw:
                if str(cyc["id"]) == cycle_id:
                    cycle_data = cyc
                    project_id = pid
                    break
            if cycle_data is not None:
                break

        if cycle_data is None or project_id is None:
            raise PlaneAPIError(f"Cycle {cycle_id} not found")

        cname = cycle_data.get("name", "")
        states = await self._get_states_map(project_id)
        done_ids = {
            sid
            for sid, s in states.items()
            if s.get("group") in ("completed", "done")
        }

        # Fetch workspace members for name resolution
        members_raw = await self._get(self._workspace_path("/members/"))
        if isinstance(members_raw, dict):
            members_raw = members_raw.get("results", [])
        name_map: dict[str, dict] = {}
        for m in members_raw:
            mid = str(m.get("member", {}).get("id", m.get("id", "")))
            info = m.get("member", m)
            name_map[mid] = {
                "name": info.get("display_name") or info.get("first_name", ""),
                "avatar_url": info.get("avatar"),
            }

        # Fetch cycle issues
        cycle_issues = await self._get(
            self._project_path(
                project_id, f"/cycles/{cycle_id}/cycle-issues/"
            )
        )
        if isinstance(cycle_issues, dict):
            cycle_issues = cycle_issues.get("results", [])

        # Aggregate per member
        perf_map: dict[str, dict] = {}
        total_assigned = len(cycle_issues)
        total_completed = 0

        for ci in cycle_issues:
            issue = ci.get("issue_detail", ci)
            assignees = issue.get("assignees", [])
            estimate = _safe_float(issue.get("estimate_point"))
            state_id = str(issue.get("state", ""))
            is_done = state_id in done_ids

            if is_done:
                total_completed += 1

            for aid_raw in assignees:
                aid = str(aid_raw)
                if aid not in perf_map:
                    info = name_map.get(aid, {})
                    perf_map[aid] = {
                        "member_id": aid,
                        "name": info.get("name", aid),
                        "avatar_url": info.get("avatar_url"),
                        "points_completed": 0.0,
                        "tasks_completed": 0,
                        "tasks_assigned": 0,
                        "max_task_complexity": 0.0,
                        "task_estimates": [],
                    }
                entry = perf_map[aid]
                entry["tasks_assigned"] += 1
                if is_done:
                    entry["tasks_completed"] += 1
                    entry["points_completed"] += estimate
                if estimate > entry["max_task_complexity"]:
                    entry["max_task_complexity"] = estimate
                entry["task_estimates"].append(estimate)

        members_perf: list[MemberCyclePerformance] = []
        for p in perf_map.values():
            estimates = p.pop("task_estimates")
            avg_complexity = (
                sum(estimates) / len(estimates) if estimates else 0.0
            )
            members_perf.append(
                MemberCyclePerformance(
                    **p,
                    avg_task_complexity=round(avg_complexity, 2),
                )
            )

        # Build rankings
        rankings: dict[str, str] = {}
        if members_perf:
            by_points = sorted(
                members_perf, key=lambda x: x.points_completed, reverse=True
            )
            rankings["most_points"] = by_points[0].member_id
            rankings["least_points"] = by_points[-1].member_id

            by_tasks = sorted(
                members_perf, key=lambda x: x.tasks_completed, reverse=True
            )
            rankings["most_tasks"] = by_tasks[0].member_id
            rankings["least_tasks"] = by_tasks[-1].member_id

            by_complexity = sorted(
                members_perf,
                key=lambda x: x.avg_task_complexity,
                reverse=True,
            )
            rankings["highest_complexity"] = by_complexity[0].member_id
            rankings["lowest_complexity"] = by_complexity[-1].member_id

        completion_rate = (
            (total_completed / total_assigned * 100)
            if total_assigned > 0
            else 0.0
        )

        now = _utcnow()
        result = CycleAnalysisResponse(
            cycle_id=cycle_id,
            cycle_name=cname,
            completion_rate=round(completion_rate, 2),
            members=members_perf,
            rankings=rankings,
            last_updated=now,
            is_cached=False,
        )

        cache_key = CACHE_KEY_CYCLE_ANALYSIS.format(cycle_id=cycle_id)
        await cache_set(
            cache_key, result.model_dump(mode="json"), settings.cache_ttl
        )

        return result

    # ------------------------------------------------------------------
    # Classify helpers
    # ------------------------------------------------------------------

    async def _classify_project(self, project_id: str) -> str:
        """Return 'support' if the project has intake/soporte modules, else 'dev'."""
        try:
            modules = await self._get(
                self._project_path(project_id, "/modules/")
            )
            if isinstance(modules, dict):
                modules = modules.get("results", [])
            for mod in modules:
                mod_name = (mod.get("name") or "").lower()
                if "intake" in mod_name or "soporte" in mod_name:
                    return "support"
        except Exception as exc:
            logger.warning(
                "Could not classify project %s: %s", project_id, exc
            )
        return "dev"

    async def _get_states_map(self, project_id: str) -> dict[str, dict]:
        """Return {state_id: state_data} for a project."""
        try:
            states = await self._get(
                self._project_path(project_id, "/states/")
            )
            if isinstance(states, dict):
                states = states.get("results", [])
            return {str(s["id"]): s for s in states}
        except Exception as exc:
            logger.warning(
                "Could not fetch states for project %s: %s", project_id, exc
            )
            return {}

    # ------------------------------------------------------------------
    # PostgreSQL snapshot persistence
    # ------------------------------------------------------------------

    async def _save_team_metrics_snapshot(
        self, members: list[TeamMemberMetrics]
    ) -> None:
        """Upsert team members and save metric snapshots."""
        try:
            today = date.today()
            for m in members:
                # Ensure TeamMember row exists
                stmt = select(TeamMember).where(
                    TeamMember.plane_member_id == m.member_id
                )
                result = await self._db.execute(stmt)
                tm = result.scalar_one_or_none()

                if tm is None:
                    tm = TeamMember(
                        name=m.name,
                        plane_member_id=m.member_id,
                        avatar_url=m.avatar_url,
                    )
                    self._db.add(tm)
                    await self._db.flush()
                else:
                    tm.name = m.name
                    tm.avatar_url = m.avatar_url

                snapshot = PlaneMetricsSnapshot(
                    team_member_id=tm.id,
                    story_points_completed=m.story_points_completed,
                    tasks_completed=m.tasks_completed,
                    tasks_assigned=m.tasks_assigned,
                    priority_avg=m.priority_avg,
                    snapshot_date=today,
                )
                self._db.add(snapshot)

            await self._db.commit()
        except Exception as exc:
            logger.warning("Failed to save team metrics snapshot: %s", exc)
            await self._db.rollback()

    async def _save_projects_snapshot(
        self, projects: list[ProjectInfo]
    ) -> None:
        try:
            today = date.today()
            for p in projects:
                snapshot = ProjectStatusHistory(
                    project_id=p.project_id,
                    project_name=p.name,
                    project_type=p.project_type,
                    status=p.status,
                    progress_pct=p.progress_pct,
                    start_date=p.start_date,
                    end_date=p.end_date,
                    snapshot_date=today,
                )
                self._db.add(snapshot)
            await self._db.commit()
        except Exception as exc:
            logger.warning("Failed to save projects snapshot: %s", exc)
            await self._db.rollback()

    async def _save_cycles_snapshot(self, cycles: list[CycleInfo]) -> None:
        try:
            today = date.today()
            for c in cycles:
                snapshot = CycleSnapshot(
                    cycle_id=c.cycle_id,
                    cycle_name=c.cycle_name,
                    start_date=c.start_date,
                    end_date=c.end_date,
                    tasks_assigned=c.tasks_assigned,
                    tasks_completed=c.tasks_completed,
                    completion_rate=c.completion_rate,
                    is_active=c.is_active,
                    snapshot_date=today,
                )
                self._db.add(snapshot)
            await self._db.commit()
        except Exception as exc:
            logger.warning("Failed to save cycles snapshot: %s", exc)
            await self._db.rollback()

    # ------------------------------------------------------------------
    # PostgreSQL fallback readers
    # ------------------------------------------------------------------

    async def _team_metrics_from_snapshot(self) -> TeamMetricsResponse:
        """Load latest team metrics from PostgreSQL snapshots."""
        stmt = (
            select(PlaneMetricsSnapshot)
            .order_by(desc(PlaneMetricsSnapshot.snapshot_date))
            .limit(50)
        )
        result = await self._db.execute(stmt)
        rows = result.scalars().all()

        if not rows:
            return TeamMetricsResponse(
                members=[],
                total_story_points=0,
                total_tasks_completed=0,
                last_updated=_utcnow(),
                is_cached=False,
            )

        # Group by team_member_id, keep latest per member
        latest: dict[int, PlaneMetricsSnapshot] = {}
        for row in rows:
            if row.team_member_id not in latest:
                latest[row.team_member_id] = row

        # Resolve member names
        tm_ids = list(latest.keys())
        tm_stmt = select(TeamMember).where(TeamMember.id.in_(tm_ids))
        tm_result = await self._db.execute(tm_stmt)
        tm_map = {tm.id: tm for tm in tm_result.scalars().all()}

        total_points = 0.0
        total_tasks = 0
        members_out: list[TeamMemberMetrics] = []

        for tm_id, snap in latest.items():
            tm = tm_map.get(tm_id)
            pts = snap.story_points_completed or 0.0
            total_points += pts
            total_tasks += snap.tasks_completed or 0

        for tm_id, snap in latest.items():
            tm = tm_map.get(tm_id)
            pts = snap.story_points_completed or 0.0
            rel = (pts / total_points * 100) if total_points > 0 else 0.0
            members_out.append(
                TeamMemberMetrics(
                    member_id=tm.plane_member_id if tm else str(tm_id),
                    name=tm.name if tm else "Unknown",
                    avatar_url=tm.avatar_url if tm else None,
                    story_points_completed=pts,
                    tasks_completed=snap.tasks_completed or 0,
                    tasks_assigned=snap.tasks_assigned or 0,
                    priority_avg=snap.priority_avg or 0.0,
                    relative_effort=round(rel, 2),
                )
            )

        last_date = max(r.snapshot_date for r in rows)
        return TeamMetricsResponse(
            members=members_out,
            total_story_points=total_points,
            total_tasks_completed=total_tasks,
            last_updated=datetime.combine(
                last_date, datetime.min.time(), tzinfo=timezone.utc
            ),
            is_cached=False,
        )

    async def _projects_from_snapshot(self) -> ProjectsResponse:
        stmt = (
            select(ProjectStatusHistory)
            .order_by(desc(ProjectStatusHistory.snapshot_date))
            .limit(50)
        )
        result = await self._db.execute(stmt)
        rows = result.scalars().all()

        if not rows:
            return ProjectsResponse(
                projects=[],
                last_updated=_utcnow(),
                is_cached=False,
            )

        seen: dict[str, ProjectStatusHistory] = {}
        for row in rows:
            if row.project_id not in seen:
                seen[row.project_id] = row

        projects_out = [
            ProjectInfo(
                project_id=r.project_id,
                name=r.project_name,
                project_type=r.project_type or "dev",
                status=r.status or "blue",
                progress_pct=r.progress_pct or 0.0,
                start_date=r.start_date,
                end_date=r.end_date,
                member_count=0,
            )
            for r in seen.values()
        ]

        last_date = max(r.snapshot_date for r in rows)
        return ProjectsResponse(
            projects=projects_out,
            last_updated=datetime.combine(
                last_date, datetime.min.time(), tzinfo=timezone.utc
            ),
            is_cached=False,
        )

    async def _cycles_from_snapshot(self) -> CyclesResponse:
        stmt = (
            select(CycleSnapshot)
            .order_by(desc(CycleSnapshot.snapshot_date))
            .limit(100)
        )
        result = await self._db.execute(stmt)
        rows = result.scalars().all()

        if not rows:
            return CyclesResponse(
                cycles=[], last_updated=_utcnow(), is_cached=False
            )

        seen: dict[str, CycleSnapshot] = {}
        for row in rows:
            if row.cycle_id not in seen:
                seen[row.cycle_id] = row

        cycles_out = [
            CycleInfo(
                cycle_id=r.cycle_id,
                cycle_name=r.cycle_name or "",
                start_date=r.start_date,
                end_date=r.end_date,
                tasks_assigned=r.tasks_assigned or 0,
                tasks_completed=r.tasks_completed or 0,
                completion_rate=r.completion_rate or 0.0,
                is_active=r.is_active,
            )
            for r in seen.values()
        ]

        last_date = max(r.snapshot_date for r in rows)
        return CyclesResponse(
            cycles=cycles_out,
            last_updated=datetime.combine(
                last_date, datetime.min.time(), tzinfo=timezone.utc
            ),
            is_cached=False,
        )

    async def _cycle_analysis_from_snapshot(
        self, cycle_id: str
    ) -> CycleAnalysisResponse:
        """Fallback: return a minimal analysis from the cycle snapshot."""
        stmt = (
            select(CycleSnapshot)
            .where(CycleSnapshot.cycle_id == cycle_id)
            .order_by(desc(CycleSnapshot.snapshot_date))
            .limit(1)
        )
        result = await self._db.execute(stmt)
        row = result.scalar_one_or_none()

        if row is None:
            raise PlaneAPIError(
                f"No snapshot available for cycle {cycle_id}"
            )

        return CycleAnalysisResponse(
            cycle_id=cycle_id,
            cycle_name=row.cycle_name or "",
            completion_rate=row.completion_rate or 0.0,
            members=[],
            rankings={},
            last_updated=datetime.combine(
                row.snapshot_date, datetime.min.time(), tzinfo=timezone.utc
            ),
            is_cached=False,
        )


# ----------------------------------------------------------------------
# Module-level utility functions
# ----------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _safe_float(value: object) -> float:
    """Convert a value to float, returning 0.0 on failure."""
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _priority_to_number(priority: str | None) -> float:
    """Map Plane priority labels to numeric values (higher = more urgent)."""
    mapping = {
        "urgent": 4.0,
        "high": 3.0,
        "medium": 2.0,
        "low": 1.0,
        "none": 0.0,
    }
    if priority is None:
        return 0.0
    return mapping.get(str(priority).lower(), 0.0)


def _parse_date(value: str | None) -> date | None:
    """Best-effort date parsing from ISO strings."""
    if not value:
        return None
    try:
        return date.fromisoformat(value[:10])
    except (ValueError, TypeError):
        return None


def _traffic_light(progress: float, project: dict) -> str:
    """Determine traffic-light status for a project.

    - blue: new / no issues yet
    - green: progress >= 70%
    - yellow: progress 30-69%
    - red: progress < 30% or overdue
    """
    if progress == 0.0:
        return "blue"

    # Check if project might be overdue (end_date in the past)
    end_str = project.get("end_date") or project.get("updated_at")
    if end_str:
        end_date = _parse_date(end_str)
        if end_date and end_date < date.today() and progress < 100.0:
            return "red"

    if progress >= 70.0:
        return "green"
    if progress >= 30.0:
        return "yellow"
    return "red"


def _is_cycle_active(cycle: dict) -> bool:
    """Determine if a cycle is currently active based on dates."""
    today = date.today()
    start = _parse_date(cycle.get("start_date"))
    end = _parse_date(cycle.get("end_date"))

    if start and end:
        return start <= today <= end
    if start and not end:
        return start <= today
    return False
