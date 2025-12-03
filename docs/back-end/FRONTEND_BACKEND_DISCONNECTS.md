# Frontend-Backend Disconnects Analysis

This document lists all areas where frontend UI elements are not properly connected to backend APIs.

## 🔴 Critical Issues (Functionality Missing)

### 1. Recent Progress Section - HARDCODED in Most Dashboards
**Status:** Student Leader Dashboard ✅ Works | Others ❌ Hardcoded

**Issue:** 
- **Student Leader Dashboard** has dynamic loading from backend (see `loadRecentProgress()`)
- **ALL OTHER dashboards** (Instructor, TA, Tutor, Student) have hardcoded week data in HTML

**Files with Hardcoded Data:**
- `src/views/instructor-dashboard.html` (lines 130-152)
- `src/views/ta-dashboard.html` (lines 123-145)  
- `src/views/tutor-dashboard.html` (lines 117-139)
- `src/views/student-dashboard.html` (lines 150-172)

**Solution:** Copy the `loadRecentProgress()` function from `student-leader-dashboard.js` to other dashboard JS files

---

### 2. Create Attendance Button - NO EVENT HANDLER
**Location:** `src/views/ta-dashboard.html` line 68

**Issue:** Button exists but has no JavaScript event handler
```html
<button id="createAttendanceBtn" class="btn btn-primary btn-create-attendance" aria-label="Add attendance">+</button>
```

**Current State:** Button does nothing when clicked
**Solution Needed:** 
- Add event handler in `ta-dashboard.js`
- Or remove button if not needed

---

### 3. Hardcoded Stats - PLACEHOLDER VALUES

#### Student Dashboard (`student-dashboard.js` lines 55-68):
- ❌ **Group Members**: Hardcoded to `0` (comment: "would need backend to get team members")
- ❌ **Assignments Due**: Hardcoded to `0` (comment: "would need assignments endpoint")  
- ❌ **Weeks Left**: Hardcoded to `4` (comment: "placeholder")

#### TA Dashboard (`ta-dashboard.js` lines 58-69):
- ❌ **To Grade**: Hardcoded to `0` (comment: "Would need assignments/grading endpoint")
- ⚠️ **Teams Assigned**: Shows all teams, not filtered by TA assignment

#### Tutor Dashboard (`tutor-dashboard.js` lines 65-74):
- ❌ **To Grade**: Hardcoded to `0` (comment: "Would need assignments/grading endpoint")
- ⚠️ **Teams Assigned**: Shows all teams, not filtered by tutor assignment

**Solution Needed:**
- Create backend endpoints for:
  - Team member count per user
  - Assignments/grading items system
  - Weeks remaining calculation
  - TA/tutor team assignment filtering

---

## 🟡 Medium Priority Issues

### 4. Hardcoded Course Title in HTML
**Location:** All dashboard HTML files

**Issue:** HTML contains hardcoded "CSE 210: Software Engineering"
```html
<h3>CSE 210: Software Engineering</h3>
```

**Note:** JavaScript does update this via `updateStickyHeader()`, but shows wrong content initially
**Impact:** Minor - causes flash of wrong content on page load

---

### 5. Course Description Placeholder Text
**Location:** All dashboard HTML files

**Issue:** Shows "Insert course description<br>& team information" as placeholder
```html
<p>Insert course description<br>& team information</p>
```

**Note:** JavaScript `updateStickyHeader()` replaces this with actual course info
**Impact:** Minor - shows placeholder text briefly before JS loads

---

## Summary

### Quick Fixes Needed:
1. **Copy `loadRecentProgress()` function** from student-leader-dashboard.js to:
   - instructor-dashboard.js
   - ta-dashboard.js  
   - tutor-dashboard.js
   - student-dashboard.js

2. **Remove or implement Create Attendance button** in TA dashboard

3. **Add backend APIs for missing stats:**
   - Team member count
   - Assignments/grading
   - Weeks calculation (or use existing offering dates)
   - TA/tutor team filtering

### Files to Update:
- `src/public/js/instructor-dashboard.js` - Add loadRecentProgress()
- `src/public/js/ta-dashboard.js` - Add loadRecentProgress() + handle Create Attendance button
- `src/public/js/tutor-dashboard.js` - Add loadRecentProgress()
- `src/public/js/student-dashboard.js` - Add loadRecentProgress()
