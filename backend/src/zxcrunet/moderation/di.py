from dishka import Provider, Scope, provide, provide_all
from sqlalchemy.ext.asyncio import AsyncSession

from zxcrunet.moderation.application.use_cases import (
    DecideReport,
    ListAuditLog,
    ListReports,
    OpenReports,
    ReportedSites,
    SiteSuspender,
    SubmitReport,
)
from zxcrunet.moderation.domain.repository import AuditLog, ReportRepository
from zxcrunet.moderation.infrastructure.adapters import SitesReported, SitesSuspender
from zxcrunet.moderation.infrastructure.repository import SqlAuditLog, SqlReportRepository
from zxcrunet.shared.application.admin import AuditTrail
from zxcrunet.sites.application.admin import SiteDirectory, SuspendSite


class ModerationProvider(Provider):
    scope = Scope.REQUEST

    @provide
    def reports(self, session: AsyncSession) -> ReportRepository:
        return SqlReportRepository(session)

    @provide
    def log(self, session: AsyncSession) -> SqlAuditLog:
        return SqlAuditLog(session)

    @provide
    def audit_log(self, log: SqlAuditLog) -> AuditLog:
        return log

    @provide
    def audit_trail(self, log: SqlAuditLog) -> AuditTrail:
        # Same session as the use case: the entry commits together with the action.
        return log

    @provide
    def reported(self, sites: SiteDirectory) -> ReportedSites:
        return SitesReported(sites)

    @provide
    def suspender(self, suspend: SuspendSite) -> SiteSuspender:
        return SitesSuspender(suspend)

    use_cases = provide_all(SubmitReport, ListReports, DecideReport, ListAuditLog, OpenReports)
