"""Verify a session's hash-chained audit log: python -m likhit.verify <session-id>"""

import sys

from . import config
from .session import verify_log


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__)
        return 2
    path = config.SESSIONS_DIR / f"{argv[0]}.jsonl"
    if not path.is_file():
        print(f"no log for session {argv[0]}")
        return 2
    ok, final = verify_log(path)
    print(f"{'OK' if ok else 'TAMPERED'}  {final}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
