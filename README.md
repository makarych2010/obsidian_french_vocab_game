# DB Structure
## Tables:
### levels-subjects
- id (INTEGER)
- level (TEXT)
- subject (TEXT)

### french-russian
- id (INTEGER)
- french-phrase (TEXT)
- french-notes (TEXT)
- russian-phrase (TEXT)
- russian-notes (TEXT)
- subject-id (INTEGER) - FOREIGN KEY - levels-subjects.id

### game-stats
- word-id (INTEGER) - FOREIGN KEY - french-russian.id
- direction (INTEGER) // 0 - french-russian, 1 - russian-french
- repetition (INTEGER)
- interval (INTEGER)
- ease-factor (INTEGER)
- next-review-date (INTEGER)

# List of Files to Export
- data.json
- main.js
- manifest.json
- styles.css


