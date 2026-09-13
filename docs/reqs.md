# GRADE/GPA PLANNER
## Software Requirements Specification (SRS)

| | |
|---|---|
| **Project** | Personal Academic Performance & GPA Planning System |
| **Project Type** | Cloud-Based Web Application |
| **Course** | BACSE344 – Cloud Infrastructure and Architecture |
| **Assignment** | Digital Assignment – C1 Slot |
| **Faculty** | Dr. P. Anandan |
| **Document Version** | 2.1 |

---

## Table of Contents

1. Introduction
2. Problem Statement
3. Project Objectives
4. Target Users
5. System Scope
6. Assumptions & Constraints
7. High-Level System Architecture
8. User Account Requirements
9. Academic Data Structure
10. Subject Requirements
11. Assessment Requirements & Weightage Scheme
12. Incomplete Assessment Rules
13. Assessment Completion Status
14. Class Average Requirements
15. Relative Grading
16. Absolute Grading
17. Course-Type Calculation Requirements
18. Ongoing Performance vs Official Grade
19. GPA Calculation
20. CGPA Calculation
21. Academic Goals
22. Required GPA for Target CGPA
23. Required Future Assessment Marks
24. Performance Categories
25. Subject Prioritization
26. Recommendation Engine
27. Historical Academic Records
28. Performance History
29. Dashboard Requirements
30. CRUD Requirements
31. REST API Requirements
32. Database Requirements & Entity-Relationship Model
33. Proposed Technology Stack
34. Cloud Requirements
35. Security Requirements
36. Calculation Engine Requirements
37. Data Validation Requirements
38. Important Business Rules
39. Non-Functional Requirements
40. Testing & Validation Strategy
41. Risks & Mitigations
42. Acceptance Criteria
43. Assignment Compliance
44. Project Demonstration Flow
45. Project Scope Boundary
46. Final Project Definition
47. Glossary
48. Summary of Core Requirements

---

# 1. Introduction

## 1.1 Purpose

The **Grade/GPA Planner** is a cloud-based web application designed to help college students maintain their academic records, monitor assessment performance, calculate GPA and CGPA, set academic targets, determine required future performance, and receive predefined academic recommendations.

The system is designed around the student's **actual academic assessment and grading scheme**, rather than functioning as a generic marks calculator.

The application distinguishes between:

* actual marks,
* incomplete/unavailable assessments,
* ongoing performance,
* estimated target marks,
* official final grades, and
* official GPA/CGPA.

**The system shall never present an estimated or incomplete result as an official academic grade.** This principle governs every calculation, label, and UI element in the application (see Section 38, Business Rules).

---

# 2. Problem Statement

Students commonly maintain academic marks and GPA information manually across different semesters, spreadsheets, notes, or applications.

This makes it difficult to:

1. Maintain a complete academic history.
2. Track assessment-wise performance.
3. Determine current performance when a semester is incomplete.
4. Calculate GPA and CGPA accurately.
5. Determine the GPA required to achieve a target CGPA.
6. Determine the marks required in upcoming assessments.
7. Identify subjects requiring greater attention.
8. Compare current performance with previous semesters.
9. Handle different course and grading structures.
10. Perform calculations when some assessment marks are still unavailable.

The proposed system provides a centralized platform that stores academic data and performs these calculations automatically.

---

# 3. Project Objectives

The system shall:

1. Provide individual student accounts.
2. Store academic records semester-wise.
3. Allow students to add and manage subjects.
4. Support theory, laboratory, and theory + laboratory courses.
5. Support relative and absolute grading.
6. Allow marks to be entered progressively.
7. Treat unavailable assessments as incomplete rather than zero.
8. Allow optional class-average information.
9. Calculate assessment contributions according to the applicable academic scheme.
10. Calculate official GPA and CGPA from completed courses.
11. Allow students to set GPA and CGPA targets.
12. Calculate the GPA required to achieve a target CGPA.
13. Estimate required future assessment marks as targets or ranges.
14. Categorize ongoing subjects according to predefined performance rules.
15. Identify subjects requiring greater attention.
16. Generate predefined academic recommendations.
17. Maintain historical academic records.
18. Display academic performance trends.
19. Provide complete CRUD functionality.
20. Expose functionality through RESTful APIs.
21. Store production data in a cloud-hosted relational database.
22. Deploy the application in a cloud environment.

---

# 4. Target Users

## 4.1 Primary User

The primary user is a **college student**.

The system shall support students who are:

* beginning a new semester,
* currently attending a semester,
* entering previous academic records,
* tracking completed courses,
* planning a target GPA,
* planning a target CGPA, or
* monitoring assessment performance.

A student should be able to enter academic records from previous years and semesters.

## 4.2 Secondary Users

None in the current scope. The system is single-role (student-only); no faculty, admin, or advisor role is included in v1. This is stated explicitly here to avoid scope creep during implementation — any future advisor/admin dashboard is a separate enhancement, not part of this deliverable.

---

# 5. System Scope

## 5.1 In Scope

The system shall include:

* Student authentication
* Academic year and semester management
* Subject management
* Assessment management
* Progressive mark entry
* Optional class-average entry
* Relative grading support
* Absolute grading support
* Theory course calculations
* Laboratory course calculations
* Theory + laboratory calculations
* Ongoing performance analysis
* GPA calculation
* CGPA calculation
* Target GPA/CGPA planning
* Required future GPA calculation
* Required future assessment-mark calculation
* Subject performance categorization
* Subject prioritization
* Predefined recommendations
* Historical performance analysis
* CRUD operations
* REST APIs
* Cloud database
* Cloud deployment

## 5.2 Out of Scope

The following are not part of the core system:

* Chatbot functionality
* Generative AI
* Voice assistant
* Mandatory machine learning
* Automatic retrieval of marks from university systems
* Fabrication of missing class averages
* Guaranteed prediction of official grades
* Natural-language academic question answering
* Multi-institution or configurable-university grading templates (only the scheme in Section 11 is implemented in v1)
* Mobile native applications (web, responsive only)
* Notifications/reminders (email, SMS, push)

---

# 6. Assumptions & Constraints

This section was missing from the original draft and is added because several downstream calculations (GPA formula, weightage, grade boundaries) are only valid under stated assumptions.

## 6.1 Assumptions

* The assessment scheme in Section 11 (CAT-I, CAT-II, Assignments, FAT) reflects the student's actual university scheme and is representative, not universal — it must be confirmed against the real course structure before being hard-coded as a default.
* A 10-point grade scale (S–F) is used, consistent with Section 16.
* Each subject belongs to exactly one semester, and each assessment to exactly one subject (Section 9); no cross-listed or shared assessments are supported.
* Users have basic familiarity with their own university's grading terms (CAT, FAT, CGPA) — the system does not need to teach these concepts.

## 6.2 Constraints

* Free-tier cloud services impose limits (compute, storage, connection counts, sleep/cold-start behavior) that may affect availability (see Section 41, Risks).
* The project must be demonstrable within the assignment timeline; the scope in Section 5.1 is sized accordingly.
* No integration with university portals is possible without institutional API access, which is unavailable — all data entry is manual (Section 5.2).

---

# 7. High-Level System Architecture

The system shall follow a three-tier architecture:

```text
                    STUDENT
                       │
                       ▼
            ┌───────────────────────┐
            │ Next.js Client        │
            │ App Router + UI       │
            └───────────┬───────────┘
                        │
                      HTTPS
                        │
                        ▼
            ┌───────────────────────┐
            │ Next.js Server        │
            │ API Route Handlers    │
            │                       │
            │ Authentication        │
            │ CRUD                  │
            │ Calculations          │
            │ Analysis              │
            │ Recommendations       │
            └───────────┬───────────┘
                        │
                        ▼
            ┌───────────────────────┐
            │ PostgreSQL            │
            │ Cloud Database        │
            └───────────────────────┘
```

The three tiers remain logically distinct — presentation, application/API, and
data — but the presentation and application tiers ship as a **single Next.js
deployment** rather than two separately hosted services. The tier boundary is
therefore a module boundary (client components vs. server-only route handlers
and service modules), not a network boundary, and it shall be enforced in code:
calculation, authorization, and database access shall live in server-only
modules that are never imported into client components.

---

# 8. User Account Requirements

Each student shall have an individual account.

## 8.1 Authentication

The system shall provide:

* Registration
* Login
* Logout
* Password protection
* Authenticated sessions/API access
* Token expiry and refresh (JWT access + refresh token pair, so sessions don't die mid-entry and don't stay valid indefinitely)

## 8.2 Data Isolation

A student shall only be able to:

* view their own academic records,
* create their own records,
* modify their own records, and
* delete their own records.

One student must not be able to access another student's academic information. This shall be enforced at the API layer (ownership check on every request), not only hidden in the UI.

---

# 9. Academic Data Structure

Academic information shall follow the hierarchy:

```text
User
 │
 ├── Academic Year
 │      │
 │      └── Semester
 │             │
 │             └── Subject
 │                    │
 │                    └── Assessment
 │
 └── Goals
```

Each subject shall belong to exactly one semester.

Each assessment shall belong to exactly one subject.

---

# 10. Subject Requirements

When creating a subject, the student shall provide:

1. Subject name
2. Academic year
3. Semester
4. Credits
5. Grading type
6. Course type
7. Class strength, where relevant

## 10.1 Grading Type

Each subject shall independently support:

* Relative Grading
* Absolute Grading

The grading type shall be selected **for each individual subject**, rather than globally for the student.

## 10.2 Course Type

The system shall support:

* Theory
* Laboratory
* Theory + Laboratory

The selected course type shall determine the applicable assessment and calculation rules.

---

# 11. Assessment Requirements & Weightage Scheme

Marks shall be entered progressively as assessments are completed.

The student shall not be required to enter marks for an assessment that:

* has not occurred,
* has not been evaluated, or
* is not yet available.

## 11.1 Standard Theory Assessments

> **Note on this table:** the original draft listed maximum marks per component but never stated the weightage each component contributes to the final 100-mark course total — yet Section 12's worked example assumes a 15% weight for CAT-I. That gap is closed here. These weights are a **default configuration**, not a hard-coded constant — see Section 36 — and must be confirmed against the actual course scheme before being relied on.

| Assessment   | Maximum Marks | Weight in Final Mark |
| ------------ | ------------: | --------------------: |
| CAT-I        |            50 |                   15% |
| CAT-II       |            50 |                   15% |
| Assignment 1 |            10 |          10% (contributes directly, 1:1) |
| Assignment 2 |            10 |          10% (contributes directly, 1:1) |
| Assignment 3 |            10 |          10% (contributes directly, 1:1) |
| FAT          |           100 |                   40% |
| **Total**    |               |               **100%** |

For the defined assessment scheme, CAT-I and CAT-II shall be converted to their applicable weighted contributions (mark obtained ÷ maximum mark × weight), while continuous assessment and FAT shall contribute according to the applicable course scheme.

The calculation rules — including weight, maximum marks, and applicable course types — shall be stored as **configuration data** (e.g. a database table or config file), separate from the user interface, so they can be modified if the academic scheme changes without a code change.

## 11.2 Laboratory and Theory+Laboratory Weightage

The original draft did not specify a weightage split for laboratory or combined courses. This is added as a required configuration item:

* **Laboratory-only subjects:** weightage scheme (e.g. continuous lab assessment vs. lab FAT/exam) shall be configurable per the university's lab evaluation pattern, and shall support a **pass/fail or minimum-mark component** distinct from the grade calculation (some universities require a minimum lab score independent of the overall grade).
* **Theory + Laboratory subjects:** the relative weight of the theory component vs. the laboratory component (e.g. 75%/25%, or credit-proportional) shall be configurable per subject or per university scheme, not hard-coded — see Section 17.3 for the worked example this drives.

---

# 12. Incomplete Assessment Rules

This is a mandatory system rule.

## 12.1 Unavailable Is Not Zero

If a mark has not yet been entered, the system shall treat the assessment as:

**Not Available / Incomplete**

It shall **not** treat the assessment as zero.

A mark of `0` shall only be stored when the student actually received zero.

## 12.2 Example

```text
CAT-I          42/50
CAT-II         Not Available
Assignment 1    9/10
Assignment 2    8/10
Assignment 3   Not Available
FAT            Not Available
```

The system shall:

* include CAT-I in earned marks,
* include Assignment 1,
* include Assignment 2,
* exclude unavailable assessments,
* calculate completed assessment weight,
* calculate remaining assessment weight.

For example (using the weights defined in Section 11.1):

```text
CAT-I contribution = 42/50 × 15
                   = 12.6

Assignment 1 = 9
Assignment 2 = 8

Current earned contribution = 12.6 + 9 + 8
                            = 29.6

Completed assessment weight = 15 + 10 + 10
                            = 35
```

The system shall display:

> **29.6 earned out of 35 marks currently assessed**

It shall **not** display this as the student's final course mark.

---

# 13. Assessment Completion Status

Every assessment shall have a status.

Possible states:

```text
AVAILABLE / COMPLETED
NOT AVAILABLE
```

A completed assessment must contain an actual mark.

An unavailable assessment shall not contribute to the student's earned marks.

The system shall calculate:

```text
Completed Weight
Remaining Weight
Current Earned Marks
Maximum Remaining Marks
```

This information shall be used for future-performance calculations.

---

# 14. Class Average Requirements

Class average is an **optional input**.

Where applicable, the student may enter:

```text
Student Mark
Class Average
```

Example:

```text
CAT-I
Student Mark: 42/50
Class Average: 36/50
```

The absence of a class average shall never prevent:

* mark entry,
* GPA calculation,
* CGPA calculation,
* historical record storage,
* target calculations, or
* basic performance analysis.

The system shall never invent a class average.

Assignments shall not require class-average information.

---

# 15. Relative Grading

For a subject using relative grading, the system shall use the applicable relative-grading rules defined for the academic scheme.

Where class statistics are available, the system may use:

* class strength,
* class mean,
* standard deviation,
* student marks.

## 15.1 Relative Difference

When class average is available:

```text
Relative Difference =
Student Mark − Class Average
```

## 15.2 Standardized Performance

When standard deviation is available:

```text
Z =
(Student Mark − Class Average) / Standard Deviation
```

## 15.3 Incomplete Relative Information

If sufficient class statistics are unavailable, the system shall **not claim an exact relative grade**.

Instead, it may provide:

* relative performance information, or
* a lower-confidence planning assessment.

The system shall clearly indicate when an analysis is based on incomplete class information.

---

# 16. Absolute Grading

For subjects using absolute grading, the system shall apply the configured grade boundaries.

| Final Mark | Grade | Grade Point |
| ---------: | :---: | ----------: |
|       ≥ 90 |   S   |          10 |
|   80 – <90 |   A   |           9 |
|   70 – <80 |   B   |           8 |
|   60 – <70 |   C   |           7 |
|   55 – <60 |   D   |           6 |
|   50 – <55 |   E   |           5 |
|        <50 |   F   |           0 |

These grade points shall be used for official GPA and CGPA calculations.

The grading boundaries shall be implemented as configurable academic rules rather than duplicated throughout the application.

---

# 17. Course-Type Calculation Requirements

The calculation engine shall not assume that all subjects have identical assessment structures.

## 17.1 Theory

Theory subjects shall use the configured theory assessment scheme (Section 11.1).

## 17.2 Laboratory

Laboratory subjects shall use the applicable laboratory assessment and passing requirements (Section 11.2), including any minimum-mark or pass/fail component that is independent of the grade calculation.

## 17.3 Theory + Laboratory

For Theory + Laboratory subjects, the system shall calculate the overall course result according to the applicable theory/laboratory credit or weighting structure (Section 11.2).

**Worked example (illustrative, using a 75%/25% theory/lab split):**

```text
Theory final mark:        78 / 100  →  weighted 0.75 × 78 = 58.5
Laboratory final mark:    92 / 100  →  weighted 0.25 × 92 = 23.0

Combined final mark = 58.5 + 23.0 = 81.5  →  Grade A (per Section 16)
```

The system shall produce:

**One overall course grade**

rather than separate official theory and laboratory letter grades.

---

# 18. Ongoing Performance vs Official Grade

This distinction is mandatory.

## 18.1 Ongoing Course

An ongoing subject may contain:

* completed assessment marks,
* unavailable assessments,
* current earned marks,
* remaining assessment weight,
* performance category,
* target information,
* recommended future marks.

However:

> **An ongoing subject does not have a current official grade.**

The system shall therefore never display:

```text
Current Grade: A
```

for an incomplete subject.

Instead, it may display:

```text
Performance Status: Strong Performance
Current Marks: 29.6 / 35 assessed
```

## 18.2 Completed Course

A completed subject may contain:

* final marks,
* official grade,
* official grade point,
* completed credits.

Only completed-course official grade points shall be used for official GPA/CGPA calculations.

A subject transitions from "ongoing" to "completed" **only** when every assessment component defined for its course type has a recorded mark — this transition trigger was implicit in the original draft and is stated explicitly here so the calculation engine has an unambiguous rule to implement (see BR-21 in Section 38).

---

# 19. GPA Calculation

The official GPA shall be calculated using:

```text
GPA =
Σ(Credits × Grade Point)
────────────────────────
       Σ Credits
```

Only completed courses with official grade points shall contribute to official GPA.

Ongoing subjects shall not be assigned artificial grade points.

If a semester contains **zero completed courses**, GPA is undefined for that semester (not zero) — the system shall display "Not yet available" rather than 0.00, to avoid the same "unavailable ≠ zero" error at the semester level that Section 12 prevents at the assessment level.

---

# 20. CGPA Calculation

The official CGPA shall be calculated using:

```text
CGPA =
Σ(Credits × Grade Point)
────────────────────────
       Σ Credits
```

across applicable completed courses.

The system shall account for the credit value of every course.

Historical semester records shall contribute to the student's overall CGPA.

---

# 21. Academic Goals

Students shall be able to define:

* Semester GPA targets
* Overall CGPA targets

Example:

```text
Semester 1 Target: 8.20
Semester 2 Target: 8.50
Semester 3 Target: 8.70
Semester 4 Target: 8.80
Semester 5 Target: 9.00
```

Goals shall be associated with the relevant semester or academic target.

---

# 22. Required GPA for Target CGPA

The system shall calculate the GPA required in future credits to reach a target CGPA.

The calculation shall consider:

* current CGPA,
* completed credits,
* future/remaining credits,
* target CGPA,
* credit weighting.

The general calculation shall be based on:

```text
Required Future GPA =
(Target CGPA × Total Credits −
 Current Grade Points)
────────────────────────────────
      Future Credits
```

The system shall dynamically calculate the value using the student's actual academic data.

## 22.1 Example

```text
Target CGPA: 8.80

Required Future GPA: 9.05
```

The system shall clearly distinguish this from a guaranteed outcome.

If the required GPA is greater than the maximum possible GPA (10.0), the system shall indicate that the target is mathematically unattainable under the currently entered credit assumptions, and — where useful — show the maximum CGPA that remains achievable instead of only an error state.

---

# 23. Required Future Assessment Marks

One of the primary planning features shall be determining what marks a student should aim for in remaining assessments.

For an ongoing subject, the system shall use:

* current earned weighted marks,
* completed assessment weight,
* remaining assessment weight,
* target outcome,
* applicable grading scheme,
* course type,
* available class information where relevant.

The system shall calculate a **target or recommended mark/range** for upcoming assessments.

Example:

```text
Subject: Computer Networks

Next Assessment:
CAT-II

Recommended Goal:
40–45 / 50

Purpose:
Maintain the desired performance trajectory.
```

The result shall be presented as:

* a target,
* recommended range, or
* planning requirement.

It shall never be presented as a guaranteed prediction of the final grade.

If the required mark for a remaining assessment **exceeds its maximum possible mark**, the system shall state that the target is no longer achievable through that assessment alone and, where multiple assessments remain, may redistribute the requirement across them or indicate the target grade is out of reach for that subject.

---

# 24. Performance Categories

Every ongoing subject shall be assigned a predefined performance category.

Possible categories:

1. Excellent Performance
2. Strong Performance
3. On Track
4. Needs Attention
5. Needs Improvement
6. High Risk

These categories are **not grades**.

For example:

```text
Performance Category:
Strong Performance
```

does not mean:

```text
Official Grade:
A
```

The category may consider:

* current marks,
* target requirements,
* completed assessment weight,
* remaining assessment weight,
* historical performance,
* credits,
* relative performance where available.

The exact thresholds shall be explicitly defined in the calculation engine and tested using representative scenarios (see Section 40, Testing & Validation Strategy).

---

# 25. Subject Prioritization

The system shall identify subjects that may require greater attention.

Priority scoring may consider:

* current performance,
* target gap,
* remaining assessment weight,
* course credits,
* potential improvement,
* historical performance,
* relative performance.

Example:

```text
Priority Subject:
DBMS

Reason:
High-credit subject with significant potential
to improve overall academic performance.
```

The prioritization system shall provide an understandable reason for the priority rather than presenting an unexplained score.

---

# 26. Recommendation Engine

The application shall use a **rule-based recommendation engine**.

It shall not function as a chatbot.

Recommendations shall be generated from predefined conditions.

Examples include:

### Excellent Performance
> Your performance in this subject is excellent. Maintain your current level.

### Strong Performance
> You are performing strongly in this subject. Maintain your current performance.

### On Track
> Your current performance is on track for your target.

### Needs Attention
> This subject requires additional attention to maintain your target.

### Needs Improvement
> Your current performance is below your target trajectory. Consider prioritizing this subject.

### High Risk
> Your current performance places your target at risk. This subject should receive higher attention.

### Improving
> Your performance in this subject has improved compared with previous assessments.

Recommendations shall be generated only when sufficient data is available.

---

# 27. Historical Academic Records

Students shall be able to store and view previous academic records.

Records shall be organized as:

```text
Academic Year
    ↓
Semester
    ↓
Subject
    ↓
Assessments
```

A completed semester may display:

* Subject
* Credits
* Course type
* Grading type
* Assessment marks
* Class averages where available
* Final marks
* Official grade
* Grade point
* Semester GPA

---

# 28. Performance History

The system shall use historical data to display academic trends.

Possible outputs include:

* GPA by semester
* CGPA progression
* Subject performance history
* Strongest subjects
* Subjects requiring improvement
* Performance trends
* Relative performance trends where class-average data exists

Historical data may improve recommendations, but the system shall never fabricate missing historical information.

---

# 29. Dashboard Requirements

The application shall provide a centralized dashboard displaying relevant academic information.

The dashboard may include:

```text
┌──────────────────────────────────────┐
│              GPA / CGPA              │
├──────────────────────────────────────┤
│ Current Target │ Required GPA        │
├──────────────────────────────────────┤
│ Strong Subjects │ Priority Subjects  │
├──────────────────────────────────────┤
│ Ongoing Subjects                    │
│                                      │
│ Subject   Marks   Status   Target   │
├──────────────────────────────────────┤
│ Academic Performance Trend           │
└──────────────────────────────────────┘
```

The dashboard shall prioritize actionable information rather than displaying unnecessary statistics.

---

# 30. CRUD Requirements

The application shall provide complete CRUD operations.

## 30.1 Create

The user shall be able to create:

* Account
* Academic year/semester
* Subject
* Assessment
* Marks
* Class-average information
* Academic goals

## 30.2 Read

The user shall be able to view:

* Current subjects
* Previous subjects
* Assessment marks
* Historical records
* Official grades
* GPA
* CGPA
* Goals
* Recommendations
* Performance trends

## 30.3 Update

The user shall be able to update:

* Subject information
* Credits
* Course type
* Grading type
* Class strength
* Assessment marks
* Class averages
* Goals
* Other user-created academic information

## 30.4 Delete

The user shall be able to delete appropriate:

* Subjects
* Assessments
* Semester records
* Goals
* Other user-created records

Deletion shall preserve referential and database integrity. Deleting a subject or semester shall cascade to (or block deletion of, with a clear warning) its dependent assessments — the specific cascade-vs-block policy shall be decided and documented during database design, since the original draft left this undefined.

---

# 31. REST API Requirements

The Next.js server layer shall expose RESTful APIs, implemented as App Router route handlers under `/api`, for communication with the client.

Major API groups shall include:

```text
/api/auth
/api/users
/api/semesters
/api/subjects
/api/assessments
/api/goals
/api/gpa
/api/cgpa
/api/performance
/api/recommendations
```

Example:

```text
POST    /api/subjects
GET     /api/subjects
GET     /api/subjects/{id}
PUT     /api/subjects/{id}
DELETE  /api/subjects/{id}
```

Similar CRUD endpoints shall be implemented for semesters, assessments, and goals.

The system shall publish an OpenAPI 3.x specification and a browsable API
documentation page (Swagger UI) at `/api/docs`.

The specification is not produced automatically by the framework and shall
therefore be generated from the shared request/response validation schemas
(Zod, via a schema-to-OpenAPI generator), so that a single schema definition
drives runtime validation, TypeScript types, and the published documentation,
and the three cannot drift apart.

All endpoints other than `/api/auth/register` and `/api/auth/login` shall require a valid bearer token, and shall return `401 Unauthorized` / `403 Forbidden` distinctly (missing/invalid token vs. accessing another user's record) rather than a generic error.

---

# 32. Database Requirements & Entity-Relationship Model

The production system shall use a **cloud-hosted relational database**.

Recommended database:

**PostgreSQL**

Core entities:

```text
Users
Academic Years / Semesters
Subjects
Assessments
Goals
```

Logical relationships:

```text
User
 │
 ├── Semester
 │      │
 │      └── Subject
 │             │
 │             └── Assessment
 │
 └── Goal
```

Foreign-key relationships shall be used to maintain data integrity.

SQLite may be used for local development, but PostgreSQL shall be used for the production deployment. Because ORM support differs between providers (native enum types and some column types are not available on SQLite), running PostgreSQL locally — for example via a container — is preferred so that the development and production schemas stay identical.

## 32.1 Suggested Minimum Schema

Added to make the ERD implementable directly, since the original draft named entities but not their key fields:

```text
users(id, email, password_hash, created_at)

semesters(id, user_id FK, academic_year, semester_number, gpa_target)

subjects(id, semester_id FK, name, credits, course_type,
         grading_type, class_strength, status[ongoing|completed])

assessments(id, subject_id FK, type[CAT-I|CAT-II|Assignment-N|FAT|Lab-...],
            max_marks, weight, student_mark, class_average,
            status[available|not_available])

goals(id, user_id FK, scope[semester|overall], target_value, semester_id FK NULL)
```

---

# 33. Proposed Technology Stack

The application shall be built as a single full-stack **Next.js** project
(App Router), which provides both the user interface and the REST API: one
language (TypeScript), one repository, one deployment.

## Frontend
* Next.js (App Router) — server and client components
* React
* TypeScript
* Tailwind CSS
* Recharts

## Backend
* Next.js API route handlers (`app/api/.../route.ts`)
* TypeScript (Node.js runtime)
* Prisma ORM
* Zod for request/response validation and OpenAPI generation

## Database
* PostgreSQL
* Cloud-hosted

## Authentication
* JWT-based authentication (access + refresh token pair, per Section 8.1)
* Tokens issued and read as `httpOnly`, `Secure`, `SameSite` cookies — the API is
  same-origin with the UI, so tokens need not be exposed to client-side
  JavaScript
* Secure password hashing (bcrypt or argon2, per Section 35)
* Route protection enforced in middleware and re-checked in each route handler,
  never in the client alone

## Calculation Engine
* TypeScript, in server-only modules shared by the route handlers
* Mathematical/statistical logic implemented directly (mean, standard
  deviation, weighted totals); no numerical or statistics library is required at
  this scale
* Fixed-point/decimal handling for marks and GPA values so rounding is explicit
  rather than dependent on floating-point behaviour

Machine learning and generative AI are not required.

---

# 34. Cloud Requirements

The final system shall demonstrate actual cloud deployment.

The deployed application shall include:

1. Cloud-hosted Next.js application, serving both the UI and the `/api` route
   handlers from a single deployment
2. Cloud-hosted database
3. Secure communication
4. Environment-based configuration
5. Public application URL

Where the Next.js application is deployed to a serverless platform, database
access shall go through a connection pooler (or a driver-level pooling service)
rather than one direct connection per invocation — see Section 41 (Risks).

Free-tier services should be preferred to keep the project cost approximately ₹0 where practical.

The availability and limitations of selected cloud services shall be verified during deployment — see Section 41 (Risks) for the specific limitations to check before the demo (cold starts, connection limits, storage caps).

---

# 35. Security Requirements

The system shall:

1. Hash passwords securely (e.g. bcrypt/argon2 — never a fast general-purpose hash like plain SHA-256).
2. Never store plaintext passwords.
3. Authenticate protected API requests.
4. Restrict users to their own academic records.
5. Validate input data.
6. Protect database credentials.
7. Store secrets in environment variables.
8. Avoid hard-coded credentials.
9. Use HTTPS in production.
10. Prevent unauthorized modification of another student's records.
11. Apply rate limiting on `/api/auth` endpoints to reduce brute-force login risk.
12. Keep the API same-origin with the UI, so no cross-origin access is granted by default; if an external client is ever added, CORS shall name that single origin explicitly and never `*`.

---

# 36. Calculation Engine Requirements

The calculation engine shall be separated from presentation logic. Since the UI and API live in the same Next.js project, this separation has no process boundary to enforce it: the engine shall therefore be a set of server-only modules with no React or request-handling dependencies, callable from route handlers and directly unit-testable.

It shall contain independent functions/modules for:

```text
Assessment Calculation
        ↓
Current Performance Calculation
        ↓
Future Mark Requirement
        ↓
Grade Calculation
        ↓
GPA Calculation
        ↓
CGPA Calculation
        ↓
Performance Classification
        ↓
Recommendation Generation
```

This separation shall make the academic rules easier to test and modify. Weightage tables, grade boundaries, and performance-category thresholds (Sections 11, 16, 24) shall live in configuration, not embedded as literals inside calculation functions, so a scheme change does not require touching business logic.

---

# 37. Data Validation Requirements

The system shall validate:

* Marks cannot exceed maximum marks.
* Marks cannot be negative.
* Credits must be valid positive values where applicable.
* Target GPA/CGPA must fall within the supported GPA range (0–10).
* Class averages cannot exceed the relevant maximum mark.
* Standard deviation cannot be negative.
* Assessment types must belong to the selected course structure.
* A completed assessment must have a mark.
* An unavailable assessment must not automatically receive zero.
* Semester numbers and academic years must be sequential/valid (no duplicate semester entries for the same user).
* Weightages for a given course type must sum to 100% (validated at configuration level).

Invalid data shall produce a clear validation message.

---

# 38. Important Business Rules

The following rules are mandatory:

### BR-01
There is **no "current grade" for an ongoing course**.

### BR-02
Ongoing courses use marks, assessment completion, and performance status.

### BR-03
Official grades are stored only after course completion.

### BR-04
Unavailable assessments are not treated as zero.

### BR-05
A mark of zero is valid only when the student actually received zero.

### BR-06
Class average is optional.

### BR-07
The system must remain functional when class averages are unavailable.

### BR-08
Assignments do not require class-average information.

### BR-09
Grading type is selected independently for every subject.

### BR-10
Course type determines the applicable calculation structure.

### BR-11
Historical academic records may be entered for previous semesters.

### BR-12
Every ongoing subject must receive a performance category.

### BR-13
Performance categories are not official grades.

### BR-14
Recommendations are rule-based and predefined.

### BR-15
Future marks are targets or recommended ranges, not guaranteed predictions.

### BR-16
Official GPA/CGPA calculations use official grade points from completed courses.

### BR-17
The production database must be cloud-hosted.

### BR-18
The Next.js server layer must expose RESTful APIs under `/api`.

### BR-19
The application must provide CRUD operations.

### BR-20
The calculation engine must not fabricate unavailable academic information.

### BR-21 *(new)*
A subject becomes "completed" only when every required assessment component for its course type has a recorded mark; until then it remains "ongoing" regardless of how much of the total weight has been entered.

### BR-22 *(new)*
GPA/CGPA for a scope (semester or overall) with zero completed courses is displayed as "not yet available," never as 0.00.

---

# 39. Non-Functional Requirements

## 39.1 Usability
The interface shall allow students to enter assessment marks quickly and understand their academic status without requiring technical knowledge.

## 39.2 Accuracy
Academic calculations shall follow the configured academic scheme and distinguish:

```text
Actual Mark
vs
Unavailable Mark
vs
Estimated Target
vs
Official Grade
```

## 39.3 Reliability
The system shall continue to provide core functionality when optional information such as class averages is unavailable.

## 39.4 Security
Student academic information shall only be accessible to the authenticated student.

## 39.5 Scalability
The architecture shall support additional students, semesters, subjects, and assessments without fundamental redesign.

## 39.6 Maintainability
Academic calculation rules shall be separated from UI components and database access logic.

## 39.7 Explainability
Every performance category and recommendation should be explainable through predefined rules.

## 39.8 Availability
The deployed application should remain accessible through its public cloud URL under normal operating conditions.

## 39.9 Performance *(new)*
Dashboard and calculation endpoints should respond within a few seconds under normal free-tier load; this is a target for demonstration purposes, not a formally benchmarked SLA.

---

# 40. Testing & Validation Strategy

This section was not present in the original draft. Since the calculation engine is the core value of the project, it needs explicit test coverage, not just "tested using representative scenarios" mentioned in passing.

* **Unit tests** for each calculation module (Section 36): assessment weighting, GPA, CGPA, required-future-GPA, required-future-marks, performance classification.
* **Boundary tests** for grade thresholds (e.g. exactly 90, exactly 59.99) and performance-category cutoffs.
* **Incomplete-data tests**: verify unavailable assessments are excluded (not zeroed), and that GPA/CGPA are "not yet available" rather than 0.00 when nothing is completed.
* **Unattainable-target tests**: required GPA > 10, required mark > max mark for a remaining assessment.
* **Authorization tests**: one user's token cannot read/modify another user's records.
* **Integration tests** for the CRUD API endpoints (Section 31) using representative request/response pairs.
* **Manual end-to-end walkthrough** following the demonstration flow in Section 44 before submission.

---

# 41. Risks & Mitigations

Not present in the original draft; added because free-tier cloud deployment (Section 34) is a real source of demo-day failure.

| Risk | Mitigation |
|---|---|
| Free-tier serverless "cold start" delay on first request makes the demo look broken | Warm up the deployment shortly before demonstrating; mention expected cold-start behavior if it occurs |
| Free-tier database connection limits exceeded — serverless route handlers can open a connection per invocation | Route all database access through a connection pooler; reuse a single Prisma client instance per runtime; test with realistic (low) concurrent load, not production scale |
| Calculation or authorization logic accidentally imported into a client component, shipping business rules (or secrets) to the browser | Keep the engine and data access in server-only modules; treat any such import as a build-blocking error |
| Free-tier storage/compute quota exhausted before submission deadline | Monitor usage; keep seed/test data minimal |
| Weightage or grade-boundary configuration doesn't match the actual course scheme | Confirm real values before hard-coding defaults (see Section 6.1) |
| Scope creep into chatbot/ML features (explicitly out of scope, Section 5.2) | Treat Section 5.2 as a hard boundary during implementation |

---

# 42. Acceptance Criteria

The project shall be considered functionally complete when the following scenarios work correctly.

## Scenario 1 — Account
A student can:
```text
Register → Login → Access Dashboard
```
and another student cannot access their records.

## Scenario 2 — Semester
A student can create:
```text
Academic Year → Semester
```
and associate subjects with that semester.

## Scenario 3 — Subject
A student can create a subject and specify:
```text
Credits
Course Type
Grading Type
```

## Scenario 4 — Progressive Marks
A student can enter only completed assessments.
```text
CAT-I = 42
CAT-II = unavailable
```
The system does not treat CAT-II as zero.

## Scenario 5 — Current Performance
The system displays:
```text
29.6 / 35 assessed
```
rather than a fabricated final grade.

## Scenario 6 — Target Planning
The student sets:
```text
Target CGPA = 8.80
```
The system calculates the required future GPA using actual credit-weighted data.

## Scenario 7 — Future Assessment
For an incomplete subject, the system calculates a recommended target/range for a remaining assessment.

## Scenario 8 — Completed Course
After final marks are entered:
```text
Final Mark
    ↓
Official Grade
    ↓
Grade Point
    ↓
GPA / CGPA
```
The official grade becomes part of historical academic records.

## Scenario 9 — CRUD
The student can:
```text
Create → Read → Update → Delete
```
academic records successfully.

## Scenario 10 — Cloud
The application is accessible through a public URL with:
```text
Cloud-hosted Next.js App
   (UI + /api routes)
           ↓
    Cloud PostgreSQL
```

## Scenario 11 — Unattainable Target *(new)*
Setting a target CGPA that requires a required-future-GPA above 10.0 produces a clear "not mathematically attainable" message rather than a nonsensical number.

---

# 43. Assignment Compliance

| Assignment Requirement | Project Implementation |
| ---------------------- | ----------------------------------------------------------------- |
| Real-world problem     | Academic performance and GPA planning                             |
| Web application        | Next.js (React) full-stack web application                        |
| CRUD                   | Semesters, subjects, assessments, goals                           |
| REST APIs              | Next.js API route handlers                                        |
| Cloud database         | Cloud-hosted PostgreSQL                                           |
| Cloud deployment       | Cloud-hosted Next.js app + managed database                       |
| Cloud concepts         | Client-server architecture, REST, managed database and deployment |
| Database design        | Relational academic-record schema                                 |
| API documentation      | OpenAPI/Swagger UI generated from Zod schemas                     |
| Architecture           | Three-tier cloud architecture                                     |
| Demonstration          | Complete student academic-planning workflow                       |
| Source code            | Git repository                                                    |
| Deployment              | Public cloud URL                                                   |

---

# 44. Project Demonstration Flow

The recommended demonstration workflow shall be:

```text
1. Register/Login
        ↓
2. Create Academic Year/Semester
        ↓
3. Add Subjects
        ↓
4. Select Course + Grading Type
        ↓
5. Enter Completed Assessment Marks
        ↓
6. Leave Future Assessments Unavailable
        ↓
7. View Current Performance
        ↓
8. Set GPA/CGPA Target
        ↓
9. View Required GPA
        ↓
10. View Required Future Marks
        ↓
11. View Subject Categories
        ↓
12. View Recommendations
        ↓
13. Complete Course
        ↓
14. Enter Final Marks
        ↓
15. Generate Official Grade
        ↓
16. Update GPA/CGPA
        ↓
17. View Historical Performance
```

This demonstrates the complete lifecycle of an academic record.

---

# 45. Project Scope Boundary

The project focuses on:

**Accurate academic data management + calculation + planning + performance analysis + rule-based decision support.**

It does not attempt to replace the university's official grading system.

The application provides planning and estimation based on the student's entered information.

It cannot guarantee:

* an official grade,
* a relative grade without sufficient class data,
* future academic performance, or
* university-issued results.

---

# 46. Final Project Definition

**Grade/GPA Planner is a cloud-based Personal Academic Performance and GPA Planning System that enables students to maintain semester-wise academic records, progressively enter assessment marks, support relative and absolute grading, handle different course types, calculate current academic performance, calculate official GPA and CGPA, set academic targets, determine required future GPA and assessment marks, monitor subject-wise performance, prioritize areas requiring attention, and receive predefined academic recommendations.**

The system is specifically designed to distinguish between **actual academic results, incomplete assessment information, ongoing performance, and future planning estimates**.

Its core purpose is not merely to calculate GPA, but to provide a complete academic planning workflow in which a student can answer:

> **"Where am I now, what is my target, and what do I need to do in the remaining assessments to stay on track?"**

---

# 47. Glossary

Added to make the document self-contained for anyone (e.g. a grader) unfamiliar with the terms used throughout.

| Term | Meaning |
|---|---|
| **CAT** | Continuous Assessment Test — an in-semester exam component |
| **FAT** | Final Assessment Test — the end-of-semester exam |
| **GPA** | Grade Point Average for a single semester |
| **CGPA** | Cumulative GPA across all completed semesters |
| **Grade Point** | Numeric value (0–10) assigned to a letter grade |
| **Weightage** | The percentage of the final mark a given assessment contributes |
| **Ongoing Subject** | A subject with at least one assessment still unavailable |
| **Completed Subject** | A subject where every assessment component has a recorded mark |
| **Relative Grading** | Grade determined by performance relative to the class (mean/SD) |
| **Absolute Grading** | Grade determined by fixed mark boundaries (Section 16) |

---

# 48. Summary of Core Requirements

```text
                    GRADE/GPA PLANNER
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   DATA MANAGEMENT    CALCULATION        PLANNING
        │                  │                  │
   Semesters           Marks             GPA Target
   Subjects            GPA               CGPA Target
   Assessments         CGPA              Required GPA
   Historical Data     Grade             Future Marks
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ANALYSIS ENGINE
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     Performance       Prioritization   Recommendations
      Categories          Subjects        Rule-Based
          │                │                │
          └────────────────┼────────────────┘
                           │
                    CLOUD APPLICATION
                           │
              Next.js + PostgreSQL
                           │
                    RESTful APIs
                           │
                     Cloud Deployment
```
