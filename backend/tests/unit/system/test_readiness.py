from tests.unit.system.fakes import FakeProbe
from zxcrunet.system.application.readiness import CheckReadiness


async def test_ready_when_all_probes_pass() -> None:
    report = await CheckReadiness([FakeProbe("a"), FakeProbe("b")], timeout_seconds=1)()

    assert report.ready
    assert report.checks == {"a": True, "b": True}


async def test_not_ready_when_a_probe_fails() -> None:
    report = await CheckReadiness([FakeProbe("a"), FakeProbe("b", fails=True)], 1)()

    assert not report.ready
    assert report.checks == {"a": True, "b": False}


async def test_hanging_probe_times_out() -> None:
    report = await CheckReadiness([FakeProbe("slow", hangs=True)], timeout_seconds=0.05)()

    assert report.checks == {"slow": False}
