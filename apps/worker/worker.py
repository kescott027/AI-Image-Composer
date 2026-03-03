import argparse
import time


def run_once() -> None:
    print("worker heartbeat: ok")


def run_forever(interval_seconds: int = 10) -> None:
    while True:
        run_once()
        time.sleep(interval_seconds)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AI Image Composer worker stub")
    parser.add_argument("--once", action="store_true", help="Run one heartbeat and exit")
    parser.add_argument(
        "--interval",
        type=int,
        default=10,
        help="Heartbeat interval in seconds when running continuously",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.once:
        run_once()
        return
    run_forever(interval_seconds=args.interval)


if __name__ == "__main__":
    main()
