# Sprint 1 Review / Retrospective — Friday Nov 7th, 2025

### Purpose & Attendees
Go over what we were actually able to complete for Sprint 1, what went well and what could be improved in terms of our process.
- Helena Bender
- Liam Hardy
- Zhe Kan
- Bimal Gyawali
- Bhavik Chandna
- Chuanqi
- Cynthia Vuong
- Rahat Bhatia
- Grace Yang
- Akshit Agarwal


## Agenda
- Sprint Review
- Sprint Retrospective


---

### Sprint Review + Design decisions made
- Dashboard Team
    - Refined the wireframes for the dashboard, what we want the dashboard to look like for actual users
    - 
- Login Team
    - Basic login criteria accomplished, able to get UCSD oAuth working
    - We will have to authenticate who the professor / student is based off of the database, which is inputed when the professor makes the course
    - There is no UI for the login yet, but we have some FigmaAI prototypes already.
    - Admin will add a professor's emails for a particular course. Then, when the professor tries to log in, the database will know that the professor's email is the actual professor of the course.
    - Instructor should be able to send an invite link to TAs so that they can join as TAs
- User Management Team
    - Can import and export students from CSV files
    - User management such as add, remove, or modify users and play with their permissions as well.
    - Overall Database schema for users, doesn't include assignments, specifies team, permission, name, etc. The permission management is almost complete but not entirely there.
    - UCSD extension students: How do we take them into account?
    - Right now we aren't storing session data in the DB, we should do that ideally.

**Things that got pushed to the next sprint**
- Dashboard Team
    - Create HTML / CSS / JS for our wireframe drawings and hook up to DB APIs
- Login Team
    - Nothing
- User Management Team
    - Finish up permissions in database

### Retrospective
#### What worked well?
- Splitting up into teams based off of what we needed to get done, and teams were evenly balanced (x3)
- Being able to have meetings within sub-teams
- PRs went well for different iterations of the feature, specifically for the database team.
- Branches and iterative PRs was effective for database
- Miro board for organizing the whole team's view of the project and showcase status of things was great (x3)
- Prototyping was helpfull
- Slackbot for stand-ups was great to see where everybody is for their own aspects of the project.
- Everybody contributed

#### What should we do for next sprint?
- Definitely need to finish up everything that we weren't able to get to during this sprint. (Try to get everything finalized and merged by Tuesday so that from Wed to Friday we can add on the smaller stuff to get the class directory feature as far along as possible)
- The second feature (Class directory) seems closely intertwined with what we have been working on so far, so we will try to have that done as well by next Friday.
- Meet on Wed to sync-up and review progress. Maybe Tuesday after class? (In addition to this friday meeting)


### Miscellaneous notes
- Try to merge every week so that we avoid merge hell


**Questions**

Right now we have one login page. How do we differentiate between professors and students?
- Sign up as a professor or as a student, have that specific to each course. For stuff like invite links people will be added as students, and then professor can manually add TAs
- Should we only require SSO login when registering for an account, or on every login?
- How do we handle extension students logging in?
    - Answer: Change the login to allow non ucsd emails, but once logged in, check if the student is in the database, and if they are, let them in, if not, don't! We have a whitelist for students since the professor / admin will have uploaded the roster to the database.
    - Could also have a specific link which allows for non-ucsd students to join the course as well, which the professor will send to students, or have a one-time code to join the class. We don't need to fix this right now though.




### Action Items

- [ ] Look over the database schema so that you know what's happening (Everyone)
- [ ] Merge code into main once you have code that works. We will have to handle refining code for now but we need to all have the same idea of the base codebase, we don't want to diverge too far from each other. (On call for each team) [By Tuesday]
