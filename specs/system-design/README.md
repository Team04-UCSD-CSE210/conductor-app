# System Architecture Document — Conductor App

## 1. Overview

The **Conductor App** is a collaborative web and mobile platform designed to support students and
instructors through class management, attendance tracking, stand-up journaling, and automated
communication. The system integrates authentication, persistent data storage, notification services,
and repository synchronization to streamline academic coordination and engagement.

The system follows a **client–server architecture** built on **Node.js** with a **PostgreSQL** backend.
External services such as **Auth.js**, **Gmail/Slack APIs**, and **GitHub API** are used to provide
authentication, notifications, and repository integration.

![System Architecture Diagram](./system-diagram.jpg)
*Figure 1. System architecture showing major components and data flow.*

## 2. System Components

### 2.1 Client Applications

- **Web Client**: Built using **HTML/CSS/JavaScript** with **HTMX** for interactive, partial-page updates.
- **Mobile Client**: Implemented with **React Native** or **Flutter**, ensuring cross-platform support for iOS and Android.
- Communication with the backend occurs via **HTTPS (REST / JSON / HTML)**.

**Responsibilities:**

- User login and authentication via Auth.js.
- Submission of daily stand-ups or work journals.
- Viewing attendance, classes, and analytics.
- Receiving notifications and updates.
- a11y & i18n

---

### 2.2 Backend API Server

- Built with **Node.js** using the **Express** or **Hono** framework.
- Acts as the system's central processing layer, handling client requests, database access, and external API integrations.
- Exposes **RESTful API endpoints** via HTTPS for secure data transmission.

**Core Modules:**

1. **User and Role Management** – Handles user registration, authentication, and authorization for roles (student, TA, instructor).
2. **Class Directory** – Stores class information, rosters, and metadata.
3. **Attendance Tracking** – Logs attendance records and generates summaries.
4. **Stand-Up / Work Journal** – Allows users to submit progress and reflections.
5. **Sentiment Analysis & Follow-Up** – Analyzes journal text for sentiment to trigger follow-ups.
6. **Notification System** – Sends automated alerts or reminders through Gmail or Slack.
7. **Auth.js Support** – Integrates OAuth 2.0 authentication via Google.
8. **Repository Sync** – Connects to GitHub API for journal synchronization and progress logging.

**Communication Protocols:**

- **SQL** – Backend ↔ PostgreSQL for persistent storage.
- **OAuth 2.0** – Backend ↔ Auth.js for Google authentication.
- **API Calls** – Backend ↔ GitHub / Notification services.

---

### 2.3 Database Layer

- **Database:** PostgreSQL

**Key Tables:**

| Table | Description |
|--------|--------------|
| `users` | User profiles, email addresses|
| `user_roles` | Multi-role assignment per user, optionally scoped to class or team. |
| `classes` | Course metadata (title, term, section, instructor). |
| `enrollments` | Class roster linking users to classes with enrollment status. |
| `teams` | Project teams within classes, including mission and repo URL. |
| `team_members` | Membership table linking users to teams with leader flag and availability. |
| `attendance` | Attendance records for lectures or meetings (timestamp, user, status). |
| `meetings` | Meetings metadata: start/end time, location, agenda, and notes. |
| `meeting_attendance` | Participant-level attendance for each meeting. |
| `standups` | Daily or weekly work journals with sentiment tracking and optional notifications. |
| `evaluation_journals` | Structured observation logs by TAs or tutors (target user/team, notes, sentiment). |
| `rubric_sections` | Rubric categories (Agile, Repository, CI/CD, Code, Product). |
| `rubric_items` | Rubric criteria under each section with maximum score. |
| `rubric_scores` | Individual rubric evaluations by TAs for teams or students. |
| `notifications` | Automated reminders or announcements (user, channel, template, send status). |
| `integrations` | External service connections (GitHub, Google, AWS) and related tokens/meta. |
| `reports` | Generated analytics and performance summaries (parameters, file link, timestamp). |


---

### 2.4 Authentication Service

- Managed by **Auth.js**, providing **OAuth 2.0** login via Google accounts.
- Enables secure sign-in without local password storage.
- Can optionally restrict access to users with **@ucsd.edu** domain emails.

---

### 2.5 Automated Bot / Notification Service

- Triggered by backend events such as missed attendance or negative sentiment.
- Sends automated alerts using:
  - **Gmail API** – for email notifications.
  - **Slack API** – for chat-based notifications.
- Logs notifications back into the backend for record-keeping and analytics.

---

### 2.6 External Integrations

**GitHub API:**  

- Used to synchronize user journals or stand-ups directly into GitHub repositories.  
- Supports automated updates or retrieval of project activity.

**Gmail / Slack APIs:**  

- Used by the notification service for automated messaging to users or teams.

---

## 3. Data Flow Summary

1. **Clients** send HTTPS requests (REST / JSON / HTML) to the **Backend API Server**.
2. The **Backend** processes requests and communicates with:
   - **PostgreSQL DB** for data persistence,
   - **Auth.js** for user authentication,
   - **GitHub API** for repository synchronization,
   - **Notification Service** for alerts.
3. The **Notification Service** uses **Gmail/Slack APIs** to deliver messages.
4. Responses and updates are sent back to clients securely via HTTPS.

---

## 4. Security and Authentication

- All communications are encrypted with **HTTPS**.
- Authentication uses **OAuth 2.0** through **Auth.js**.
- Role-based access ensures users only see authorized data.
- Email domain restrictions ensure valid UCSD institutional access.

---

## 5. Scalability and Maintainability

- Modular backend allows separate scaling for authentication, notifications, and journaling.
- PostgreSQL ensures relational consistency and efficient query performance.
- System integrates with **CI/CD (GitHub Actions)** for linting, testing, and continuous deployment.
- External APIs are abstracted for easy replacement or expansion.

---

## 6. Summary

The **Conductor App System Architecture** provides a scalable, secure, and modular solution for
managing student engagement, class operations, and automated communication. Its use of Node.js,
Auth.js, PostgreSQL, and modern client frameworks ensures long-term maintainability and easy
integration with institutional tools and APIs.
