# GWTP data model

GWTP uses a small central SQLite data model focused on users, training content, optional step validation, and learner progress.

## Core hierarchy

Topic -> Guide -> GuideSteps -> StepValidations (optional)

A guide has one editable set of steps. There is no draft/published copy model.

- `IsAvailable = 1`: learners may access the guide.
- `IsAvailable = 0`: learners may not access the guide; authorized editors/admins can still edit and preview it.

## Users and roles

Users have individual usernames and password hashes. Passwords are never stored as plaintext.

Roles are stored separately so one user can have more than one role:

- `admin`: manages users, roles, and system-level content administration.
- `editor`: creates, edits, and previews guides.
- `learner`: runs guides and has learning progress.

## Tables

- `Users`: user identity, password hash, and account availability.
- `UserRoles`: one or more roles per user.
- `Topics`: top-level training subjects.
- `Guides`: guides belonging to a topic and their learner availability.
- `GuideSteps`: ordered steps containing a selector and instruction.
- `StepValidations`: optional validation rules for guide steps.
- `UserProgress`: the learner's current step and completion state per guide.

## Language model

The GWTP application UI supports Hebrew and English through the extension's i18n layer.

Training content is entered once by the editor. SQLite stores text as Unicode, so names, instructions, expected values, and validation messages can contain Hebrew, English, or both without duplicate language-specific columns.

## Scope

The schema intentionally excludes audit fields, draft/version history, assessments, grades, certificates, and full LMS functionality at this stage.

The browser extension should not access SQLite directly. A data/API layer will sit between the extension and the database.
