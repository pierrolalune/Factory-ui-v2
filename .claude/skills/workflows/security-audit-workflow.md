# Security Audit Workflow

Comprehensive security audit: reconnaissance, threat modeling, exploitation, remediation.

## Phase 1: Reconnaissance

Map the attack surface.
- Identify all entry points (API endpoints, forms, file uploads)
- List technologies and versions (dependencies, frameworks)
- Map authentication and authorization flows
- Document data flows and trust boundaries
- Output: Attack surface inventory

## Phase 2: Threat Modeling

**Agent**: security

STRIDE threat analysis.
- **S**poofing: Identity/authentication threats
- **T**ampering: Data integrity threats
- **R**epudiation: Logging/audit trail gaps
- **I**nformation Disclosure: Data leakage risks
- **D**enial of Service: Resource exhaustion vectors
- **E**levation of Privilege: Authorization bypass risks
- Output: Threat model with risk ratings (Critical/High/Medium/Low)

## Phase 3: Exploitation

Attempt to exploit identified threats.
- Test for OWASP Top 10 vulnerabilities
- SQL injection, XSS, CSRF, command injection
- Authentication bypass attempts
- IDOR and access control testing
- Output: Exploitability report with CVSS scores

## Phase 4: Vulnerability Report

**Agent**: security

Document all findings.
- For each vulnerability: description, severity, exploit steps, remediation
- CVSS scoring for each finding
- Priority ordering by exploitability and business impact
- Output: Security report

## Phase 5: Remediation

**Agent**: dev

Fix identified vulnerabilities.
- Address Critical and High severity first
- Write regression tests for each fix
- Re-scan after fixes
- Loop until no Critical/High findings remain

## Phase 6: Verification

**Agent**: security

Final verification.
- Re-run all security scans (SAST, DAST, dependency audit)
- Verify all remediations are effective
- Confirm no new vulnerabilities introduced
- Output: Clean security report