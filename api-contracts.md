
# Class Directories

## Class API

### Get class info
**GET** `/api/class/{id}`

#### Response
```json
{
  "id": "cse210-fa25",
  "code": "CSE210",
  "name": "Software Engineering",
  "department": "Computer Science and Engineering",
  "term": "Fall",
  "year": 2025,
  "credits": 4,
  "start_date": "2025-09-22",
  "end_date": "2025-12-12",
  "enrollment_cap": 150,
  "status": "open",
  "location": "Building A",
  "class_timings": {
    "lectures": [
      {
        "day": "Monday",
        "startTime": "10:00",
        "endTime": "11:20",
        "location": "Building A, Room 101"
      }
    ],
    "office_hours": [
      {
        "day": "Wednesday",
        "startTime": "14:00",
        "endTime": "15:20",
        "location": "Building B, Room 202"
      }
    ]
  },
  "syllabus_url": "https://cdn...",
  "currentEnrollment": 145,
  "createdAt": "2025-06-01T12:00:00Z",
    "updatedAt": "2025-08-15T09:30:00Z",
  "created_by": {
    "userId": "uuid-admin-1",
    "name": "Admin User"
  },
    "updated_by": {
        "userId": "uuid-admin-2",
        "name": "Editor User"
    }
}
```
#### Backend logic
- Query `Course_Offerings` by `id`
---
## Professor API

### Get professor info for a class

**GET** `/api/class/{offeringId}/professor`

#### Response

```json
{
  "offeringId": "cse210-fa25",
  "professors": [
    {
      "userId": "uuid",
      "name": "John Smith",
      "preferredName": "John",
      "pronouns": "he/him",
      "photo": "https://cdn...",
      "email": "jsmith@ucsd.edu",
      "phone": "+1 858 123 4567",
      "links": {
        "linkedin": "...",
        "github": "...",
        "office_hours": "https://...",
        "class_chat": null
      },
      "availability": 
      [
        {
          "start": "2025-10-01T15:00:00-07:00",
          "end": "2025-10-01T16:00:00-07:00"
        },
        {
          "start": "2025-10-03T10:00:00-07:00",
          "end": "2025-10-03T11:00:00-07:00"
        }
      ]
    }
  ]
}
```
#### Backend logic

- Query `Course_Offerings → instructor_id`
- Join `Users` and `Availability`


---
## TA APIs

### Get all TAs for a class
**GET** `/api/class/{offeringId}/tas`
#### Response
```json
{
  "offeringId": "cse210-fa25",
  "tas": [
    {
      "userId": "uuid",
      "name": "Alice Chen",
      "preferredName": "Alice",
      "pronouns": "she/her",
      "photo": "...",
      "email": "alice@ucsd.edu",
      "section": "A01",
      "role": "TA",
      "links": {
        "linkedin": "...",
        "github": "...",
        "class_chat": null
      },
      "availability": [],
      "activity": null
    }
  ]
}
```
#### Backend logic
- Query `ENROLLMENTS` where `role = 'ta'` for the given `offeringId`.
- Join `Users` and `Availability`.
- Future works: Add activity during development phase of attendance sys.

### Get a TA's info.
`GET /api/class/ta/{taId}`
#### Response
```json
{
  "userId": "uuid",
  "name": "Alice Chen",
  "preferredName": "Alice",
  "pronouns": "she/her",
  "photo": "...",
  "email": "alice@ucsd.edu",
  "section": "A01",
  "role": "TA",
  "links": {
    "linkedin": "...",
    "github": "...",
    "class_chat": null
  },
  "availability": [],
  "activity": null
}
```
#### Backend logic
- Query `ENROLLMENTS` where `role = 'ta'` for the given `taId`.
- Join `Users` and `Availability`.

---

## Student Directory API

### Get students in a class

**GET** `/api/class/{offeringId}/students`

#### Support filters：

| Key      | Description                     |
| -------- |---------------------------------|
| `section`| by given section (e.g., A02)    |
| `search` | by name, preferred name, email  |
| `group`  | by given group name              |

#### Support pagination：

| Key     | Description               |
| ------- |---------------------------|
| `page`  | page number (default 1)   |
| `limit` | items per page (default 20)|

#### Response

```json
{
  "offeringId": "cse210-fa25",
  "students": [
    {
      "userId": "uuid",
      "name": "Andy Cheng",
      "preferredName": "Andy",
      "pronouns": "he/him",
      "photo": "...",
      "email": "andy@ucsd.edu",
      "section": "A02",
      "role": "STUDENT",
      "links": {
        "github": "...",
        "linkedin": "..."
      },
      "attendance": {
        "lectures": 12,
        "meetings": 4,
        "officeHours": 1
      },
      "activity": {
        "punchCard": []
      }
    }
  ]
}
```

#### Backend logic

- `ENROLLMENTS` where `role = 'student'`
---
## Groups API

### Get all groups in a class
**GET** `/api/class/{offeringId}/groups`

#### Query params（optional）

| Key      | Description         |
| -------- |---------------------|
| `search` | by given group name |
| `sort`   | name / number       |


#### Pagination params (optional)

| Key     | Description               |
| ------- |---------------------------|
| `page`  | page number (default 1)   |
| `limit` | items per page (default 20)|

#### Response
```json
{
  "offeringId": "cse210-fa25",
  "groups": [
    {
      "teamId": "uuid-team-1",
      "name": "Team Alpha",
      "status": "active",
      "number": 1,
      "logo": "https://cdn...",
      "mantra": "Ship fast",
      "links": {
        "slack": "https://slack...",
        "githubRepo": "https://github.com/...",
        "notion": null
      },
      "memberCount": 5,
      "leaders": [
        {
          "userId": "uuid-user-1",
          "name": "Alice Chen"
        }
      ]
    }
  ]
}
```

#### Backend logic

| Field       | Source                                  |
| ----------- | --------------------------------------- |
| teamId      | TEAM.id                                 |
| name        | TEAM.name                               |
| number      | TEAM.team_number                        |
| logo        | TEAM.metadata.logo                      |
| mantra      | TEAM.metadata.mantra                    |
| links       | TEAM.metadata.links                     |
| memberCount | COUNT(TEAM_MEMBERS)                     |
| leaders     | TEAM_MEMBERS.role = 'leader' join USERS |

### Get a specific group in a class
**GET** `/api/class//group/{teamId}`
#### Response
```json
{
  "teamId": "uuid-team-1",
  "offeringId": "cse210-fa25",
  "name": "Team Alpha",
  "number": 1,
  "logo": "https://cdn...",
  "mantra": "Ship fast",
  "status": "active",
  "links": {
    "slack": "https://slack...",
    "githubRepo": "https://github.com/team-alpha",
    "drive": "https://drive..."
  },
  "members": [
    {
      "userId": "uuid-user-1",
      "name": "Alice Chen",
      "preferredName": "Alice",
      "pronouns": "she/her",
      "photo": "https://cdn...",
      "email": "alice@ucsd.edu",
      "role": "LEADER",
      "joinedAt": "2025-02-05",
      "phone": "+1 858 123 4567"
    },
    {
      "userId": "uuid-user-2",
      "name": "Bob Lee",
      "pronouns": "he/him",
      "role": "MEMBER"
    }
  ]
}
```
#### Backend Implementation

- Query `TEAM`
- Parse `metadata (logo, mantra, links)`
- Query `TEAM_MEMBERS where team_id = {teamId}`
- Join `USERS` to get complete user info







