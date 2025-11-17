# Class Directories

## Class API

### Get class info

**GET** `/api/class/{id}`

#### Response (example)

```json
{
  "id": "00000000-aaaa-0001-aaaa-000000000001",
  "code": "CSE210",
  "name": "Software Engineering",
  "department": "CSE",
  "term": "FA",
  "year": 2025,
  "credits": 4,
  "start_date": "2025-09-20",
  "end_date": "2025-12-15",
  "enrollment_cap": 200,
  "status": "open",
  "location": "Center Hall 101",
  "class_timings": {
    "time intervals": [
      "Mon 10:00-11:20",
      "Wed 10:00-11:20"
    ]
  },
  "syllabus_url": "https://example.com/syllabus",
  "currentEnrollment": null,
  "createdAt": "2025-11-15T00:04:08.214Z",
  "updatedAt": "2025-11-15T00:04:08.214Z",
  "created_by": null,
  "updated_by": null
}
```

#### Backend logic (notes)

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

#### Response format

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

#### Backend implementation

- Query `ENROLLMENTS` where `role = 'ta'` for the given `offeringId`.
- Join `Users` and `Availability`.
- Future works: Add activity during development phase of attendance sys.

### Get a TA's info

**GET** `/api/class/ta/{taId}`

#### Response (specific TA)

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

#### Backend logic (TA info)

- Query `ENROLLMENTS` where `role = 'ta'` for the given `taId`.
- Join `Users` and `Availability`.

---

## Student Directory API

### Get students in a class

**GET** `/api/class/{offeringId}/students`

#### Support filters

| Key      | Description                     |
| -------- |---------------------------------|
| `section`| by given section (e.g., A02)    |
| `search` | by name, preferred name, email  |
| `group`  | by given group name             |

#### Support pagination

| Key     | Description               |
| ------- |---------------------------|
| `page`  | page number (default 1)   |
| `limit` | items per page (default 20)|

#### Response (students list)

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

#### Backend logic (students list)

- `ENROLLMENTS` where `role = 'student'`

---

## Groups API

### Get all groups in a class

**GET** `/api/class/{offeringId}/groups`

#### Query params (optional)

| Key      | Description         |
| -------- |---------------------|
| `search` | by given group name |
| `sort`   | name / number       |

#### Pagination params (optional)

| Key     | Description               |
| ------- |---------------------------|
| `page`  | page number (default 1)   |
| `limit` | items per page (default 20)|

#### Response (groups list)

```json
{
  "offeringId": "00000000-aaaa-0001-aaaa-000000000001",
  "groups": [
    {
      "teamId": "00000000-aaaa-0002-aaaa-000000000001",
      "name": "Team Alpha",
      "status": "active",
      "number": 1,
      "logo": null,
      "mantra": null,
      "links": {
        "slack": null,
        "githubRepo": null,
        "notion": null
      },
      "memberCount": 2,
      "leaders": [
        {
          "userId": "00000000-aaaa-0000-aaaa-000000000301",
          "name": "Bob Student"
        }
      ]
    },
    {
      "teamId": "00000000-aaaa-0002-aaaa-000000000002",
      "name": "Team Beta",
      "status": "active",
      "number": 2,
      "logo": null,
      "mantra": null,
      "links": {
        "slack": null,
        "githubRepo": null,
        "notion": null
      },
      "memberCount": 2,
      "leaders": [
        {
          "userId": "00000000-aaaa-0000-aaaa-000000000302",
          "name": "Carol Student"
        }
      ]
    }
  ]
}
```

#### Backend logic (groups list)

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

#### Response (specific group)

```json
{
  "teamId": "00000000-aaaa-0002-aaaa-000000000001",
  "offeringId": "00000000-aaaa-0001-aaaa-000000000001",
  "name": "Team Alpha",
  "number": 1,
  "logo": null,
  "mantra": null,
  "status": "active",
  "links": {
    "slack": null,
    "githubRepo": null,
    "drive": null
  },
  "members": [
    {
      "userId": "00000000-aaaa-0000-aaaa-000000000301",
      "name": "Bob Student",
      "preferredName": "Bob",
      "pronouns": null,
      "photo": null,
      "email": "bob@ucsd.edu",
      "role": "LEADER",
      "joinedAt": "2025-11-15",
      "phone": null
    },
    {
      "userId": "00000000-aaaa-0000-aaaa-000000000303",
      "name": "Dave Student",
      "preferredName": "Dave",
      "pronouns": null,
      "photo": null,
      "email": "dave@ucsd.edu",
      "role": "MEMBER",
      "joinedAt": "2025-11-15",
      "phone": null
    }
  ]
}
```

#### Backend Implementation

- Query `TEAM`
- Parse `metadata (logo, mantra, links)`
- Query `TEAM_MEMBERS where team_id = {teamId}`
- Join `USERS` to get complete user info
