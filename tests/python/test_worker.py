from apps.worker.worker import parse_args


def test_worker_parse_args_defaults(monkeypatch) -> None:
    monkeypatch.setattr("sys.argv", ["worker.py"])
    args = parse_args()

    assert args.once is False
    assert args.run_job_once is False
    assert args.poll_jobs is False
    assert args.interval == 10
