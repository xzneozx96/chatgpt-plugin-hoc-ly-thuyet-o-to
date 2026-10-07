"""Rebuild src/content/question-families.json from the batch reviews in results/.

Run from the repository root: python3 docs/family-review/apply.py
Reads the pre-review catalogue from git (commit f630bca) so the output depends only on the reviews.
"""
import json
import subprocess
from pathlib import Path

BASE_COMMIT = "f630bca"
TARGET = Path("src/content/question-families.json")
REVIEWED_ON = "2026-10-07"
# Owner-approved bank fixes after the review: q215's stem became the official curve question, so it no longer
# belongs to the slippery-road groups it was grouped into by its old wording.
LATER_REMOVALS = {"wet-road-flooding": {"q215"}, "tech-signs-surface-grip": {"q215"}}

original = json.loads(subprocess.run(["git", "show", f"{BASE_COMMIT}:{TARGET}"], capture_output=True, text=True, check=True).stdout)
reviews = {}
for path in sorted(Path("docs/family-review/results").glob("batch-*.json")):
    for review in json.loads(path.read_text()):
        assert review["id"] not in reviews, review["id"]
        reviews[review["id"]] = review
assert set(reviews) == {f["id"] for f in original}, "every family needs exactly one review"

approved = []
for family in original:
    review = reviews[family["id"]]
    if review["verdict"] == "reject":
        continue
    removed = set(review.get("removeMembers", [])) | LATER_REMOVALS.get(family["id"], set())
    assert removed <= set(family["questionIds"]), family["id"]
    members = [q for q in family["questionIds"] if q not in removed]
    assert len(members) >= 2, family["id"]
    approved.append({
        **family,
        "title": review.get("title", family["title"]),
        "comparisonAxes": review.get("comparisonAxes", family["comparisonAxes"]),
        "questionIds": members,
        "status": "approved",
        "reviewedOn": REVIEWED_ON,
    })

TARGET.write_text(json.dumps(approved, ensure_ascii=False, indent=2) + "\n")
covered = {q for f in approved for q in f["questionIds"]}
print(f"{len(approved)} approved families covering {len(covered)} questions")
