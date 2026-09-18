# GWTP data model

The initial central data model uses SQLite and intentionally avoids a full versioning system.

## Core hierarchy

Topic -> Guide -> GuideSteps

Each guide can contain two independent step sets:

- `draft`: editable content used by the editor and Preview.
- `published`: the stable content available to learners.

Publishing will copy/replace the guide's published step set from the current draft in one controlled operation. Editing a draft therefore does not change the learner experience until Publish is explicitly performed.

## Tables

- `Users`: minimal user identity and role.
- `Topics`: bilingual training subjects.
- `Guides`: bilingual guides belonging to a topic.
- `GuideSteps`: bilingual steps separated by `draft` / `published`.
- `UserProgress`: per-user position and completion state for a guide.

## Scope

This schema is intentionally small. It does not introduce course management, assessments, grades, certificates, or version history.

The extension should not access SQLite directly. A data/API layer will be introduced between the extension and the database so storage can evolve without coupling the browser UI to SQLite.
