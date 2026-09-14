# CI negative test — evidence for Progress Report

**Date:** 14 September 2026  
**Purpose:** Show that the GitHub Actions gate **blocks** a change that would let leaked PII pass as a “clean” email. This branch is evidence only. **Do not merge it into `master`.**

## What we did

The LLMSecOps corpus treats `backend/tests/fixtures/llmsecops/clean.json` as a known-good email: Guardian must return **PASS**.

On branch `ci/demo-fail-pii` (commit `7a219d3`) that fixture was edited so the body contains another person’s identifiers:

```
Call Jane at 9123 4567 or jane.doe@hotmail.com to redeem.
```

No Guardian code was weakened. The test still expects PASS. The gate should therefore **fail**, because `run_checks` returns **BLOCK** (`No leaked identifiers`).

## Local result (same assertion GitHub Actions runs)

Command (from `backend/`):

```bash
python -m pytest tests/test_llmsecops_guardian.py::test_clean_email_passes -q
```

Output:

```
F                                                                        [100%]
================================== FAILURES ===================================
___________________________ test_clean_email_passes ___________________________

isolated_guardian = None

    def test_clean_email_passes(isolated_guardian):
        checks = run_checks(load_fixture("clean"))
>       assert verdict_for(checks) == "PASS"
E       AssertionError: assert 'BLOCK' == 'PASS'
E
E         - PASS
E         + BLOCK

tests\test_llmsecops_guardian.py:15: AssertionError
=========================== short test summary info ===========================
FAILED tests/test_llmsecops_guardian.py::test_clean_email_passes
1 failed in 0.48s
```

That is the intended failure: CI is not “broken”; it refused to treat a PII leak as clean.

## Pull request (open this, do not merge)

GitHub CLI was not logged in on this machine, so the PR may need one click:

**https://github.com/bearly-profitable/MOSAIC/compare/master...ci/demo-fail-pii?expand=1**

Suggested title: `DO NOT MERGE: CI negative test (PII in clean fixture)`

Suggested body:

> Negative test for the LLMSecOps corpus. `clean.json` was given a leaked phone/email so `test_clean_email_passes` must fail. Close after capturing the red Actions check. Do not merge.

On the PR, wait for **MLOps · Guardian corpus and contracts** to go red. Screenshot that job and the pytest snippet above for the written report.

## What not to do

- Do not merge `ci/demo-fail-pii` into `master`.
- After the screenshot, close the PR and delete the branch. `master` keeps the real `clean.json` (no identifiers).

## Mapping to the rubric

| Rubric idea | This artefact |
|---|---|
| CI/CD on the repo | `.github/workflows/ci.yml` on `master` (`0557e85`) |
| LLMSecOps gate | Guardian corpus; PII must BLOCK |
| Negative test | This branch: a “clean” fixture that is no longer clean is rejected |
