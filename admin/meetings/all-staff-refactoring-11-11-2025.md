# Meeting Notes — Nov 11, 2025

### Purpose & Attendees
Refactor our team structure since we have been behind and not efficiently
Everybody was here!
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
- Astoria Ma
- Andy Cheng
- Haiyi Xing

## Agenda
- Restructure the teams and go over feedback TA gave
- Go over sprint 2 deliverables


---

### Notes
- When splitting into teams only a couple of people contribute in meetings and give feedback
- We will have smaller teams with smaller tasks
- Because there are so many of us, communication is hard and there can be miscommunications even within one feature
    - Splitting into smaller teams will help allow people to work individually
- Have subgroups with different tasks, don't have Rahat and Helena in each team, have a team lead that understands the entire feature / task that that sub-group is working on.
- Subgroups are max 3 people, preferably 2 people. Among them, there will be one person who will be the team lead's point of contact so that team leads can understand what's happening in each sub-group.

Sprint 1 catch-up deliverables
- Login
    - Finalize login, get it working for extension students
- Databases
    - Done!
- Dashboards
    - Connecting dashboards from log-in

#### Notes on design of login:
- We now have a blacklist and a whitelist
- For non UCSD login, wait for approval for admin
- Admin can approve the email id, but right now we can't get that email id back from the google api
- Everything works except for external gmail account.

Flow for non-ucsd:
- Form: enter your email, enter why you want to log in
- Goes to admin approval, admin can approve, and email id will be added to the whitelist
- When logging in, you either need to be a ucsd email or be on the whitelist
Why it's not working:
- google api doesn't extract email id from the database so it's not working

#### Notes on database design
- What are you asking from user?
    - PID
    - Course
    - Departmenta
    - Email


#### Notes for Class Directory feature
- Not much changes to database, mainly just frontend work



## Feedback on old team structure vs new proposed
- Old structure allowed for miscommunication and people to overlap which tasks they were working on by accident.
- With larger groups it's hard to catch up on the progress if you were busy for a couple of days
- Communication between teams was difficult
- With more subteams and sub-leaders, it's important to predefine what the subteam is going to handle so that everything is clear
- Concern with new approach: We still have to distribute the task among members of the group, which could still run into similar issues
- We should have the team leads talk to each other / have a meeting so that we can be fully modular and cohesive.
- Problem: it's really hard to modularize things like "log-in" and divide them cleanly to give everybody an equal sub-task
- When we define tasks we should define the sequence of the tasks so we know what's blocked by everything else. 
- Some people are busier than others soem days, so having smaller teams of 2 for example, the hit by a bus problem is more prevalent if one or both of them is super busy for a couple of days. 
- With the number of people, it's hard to divide the work in one feature between all 13 of us, since it seems like it would work better to have that work split between ~6 people, with the 7 other people working on something for another sprint. 

### Action Items

- Login 
    - [ ] External gmail login not working (google api not returning the email) (Bimal and Akshit)
    - [ ] Retry (should lock out after 3 tries) (Bimal and Akshit)
- DB
    - [ ] Extension (Bhavik)
    - [ ] Review (Astoria, Bhavik and Haiyi)
- Middle ware
    - [ ] RBAC (Zhe and Astoria)
- Dashboard
    - [ ] Finishing (Colors and Consistency ) (Cynthia and Liam)
    - [ ] Merging (Grace)
- Class directory
    - [ ] Middleware (Andy and Chuanqi)
    - [ ] UI ( Helena and Rahat)
