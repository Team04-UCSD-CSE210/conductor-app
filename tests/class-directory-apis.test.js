// tests/class-directory-apis.test.js
// Contract tests for Class Directory User Cards APIs
// These tests validate the JSON response SHAPE according to api-contracts.md
// using mocked payloads, so they do not depend on a running HTTP server.

import test from 'node:test';
import assert from 'node:assert/strict';

// Helpers to validate response contracts -------------------------------------

function assertProfessorResponse(body) {
  // Root-level fields
  assert.ok(
    typeof body.offeringId === 'string' || typeof body.offeringId === 'number',
    'offeringId should be string or number'
  );
  assert.ok(Array.isArray(body.professors), 'professors should be an array');

  // Validate one professor card (using first element when present)
  if (body.professors.length > 0) {
    const p = body.professors[0];
    assert.ok(p.userId !== undefined, 'professor.userId should be present');
    assert.equal(typeof p.name, 'string', 'professor.name should be string');
    assert.ok('preferredName' in p, 'professor.preferredName should exist');
    assert.ok('pronouns' in p, 'professor.pronouns should exist');
    assert.ok('photo' in p, 'professor.photo should exist');
    assert.equal(typeof p.email, 'string', 'professor.email should be string');
    assert.ok('phone' in p, 'professor.phone should exist');

    assert.ok(p.links && typeof p.links === 'object', 'professor.links should be an object');
    assert.ok('linkedin' in p.links, 'links.linkedin should exist');
    assert.ok('github' in p.links, 'links.github should exist');
    assert.ok('office_hours' in p.links, 'links.office_hours should exist');
    assert.ok('class_chat' in p.links, 'links.class_chat should exist');

    assert.ok(Array.isArray(p.availability), 'professor.availability should be an array');
  }
}

function assertTasResponse(body) {
  assert.ok(
    typeof body.offeringId === 'string' || typeof body.offeringId === 'number',
    'offeringId should be string or number'
  );
  assert.ok(Array.isArray(body.tas), 'tas should be an array');

  if (body.tas.length > 0) {
    const ta = body.tas[0];
    assert.ok(ta.userId !== undefined, 'ta.userId should be present');
    assert.equal(typeof ta.name, 'string', 'ta.name should be string');
    assert.ok('preferredName' in ta, 'ta.preferredName should exist');
    assert.ok('pronouns' in ta, 'ta.pronouns should exist');
    assert.ok('photo' in ta, 'ta.photo should exist');
    assert.equal(typeof ta.email, 'string', 'ta.email should be string');
    assert.ok('section' in ta, 'ta.section should exist');
    assert.equal(ta.role, 'TA', 'ta.role should be "TA"');

    assert.ok(ta.links && typeof ta.links === 'object', 'ta.links should be an object');
    assert.ok('linkedin' in ta.links, 'links.linkedin should exist');
    assert.ok('github' in ta.links, 'links.github should exist');
    assert.ok('class_chat' in ta.links, 'links.class_chat should exist');

    assert.ok(Array.isArray(ta.availability), 'ta.availability should be an array');
    assert.ok('activity' in ta, 'ta.activity should exist');
  }
}

function assertSingleTaResponse(ta) {
  assert.ok(ta.userId !== undefined, 'ta.userId should be present');
  assert.equal(typeof ta.name, 'string', 'ta.name should be string');
  assert.ok('preferredName' in ta, 'ta.preferredName should exist');
  assert.ok('pronouns' in ta, 'ta.pronouns should exist');
  assert.ok('photo' in ta, 'ta.photo should exist');
  assert.equal(typeof ta.email, 'string', 'ta.email should be string');
  assert.ok('section' in ta, 'ta.section should exist');
  assert.equal(ta.role, 'TA', 'ta.role should be "TA"');

  assert.ok(ta.links && typeof ta.links === 'object', 'ta.links should be an object');
  assert.ok('linkedin' in ta.links, 'links.linkedin should exist');
  assert.ok('github' in ta.links, 'links.github should exist');
  assert.ok('class_chat' in ta.links, 'links.class_chat should exist');

  assert.ok(Array.isArray(ta.availability), 'ta.availability should be an array');
  assert.ok('activity' in ta, 'ta.activity should exist');
}

function assertStudentsResponse(body) {
  assert.ok(
    typeof body.offeringId === 'string' || typeof body.offeringId === 'number',
    'offeringId should be string or number'
  );
  assert.ok(Array.isArray(body.students), 'students should be an array');
  assert.equal(typeof body.page, 'number', 'page should be a number');
  assert.equal(typeof body.limit, 'number', 'limit should be a number');
  assert.equal(typeof body.total, 'number', 'total should be a number');

  if (body.students.length > 0) {
    const s = body.students[0];
    assert.ok(s.userId !== undefined, 'student.userId should be present');
    assert.equal(typeof s.name, 'string', 'student.name should be string');
    assert.ok('preferredName' in s, 'student.preferredName should exist');
    assert.ok('pronouns' in s, 'student.pronouns should exist');
    assert.ok('photo' in s, 'student.photo should exist');
    assert.equal(typeof s.email, 'string', 'student.email should be string');
    assert.ok('section' in s, 'student.section should exist');
    assert.equal(s.role, 'STUDENT', 'student.role should be "STUDENT"');

    assert.ok(s.links && typeof s.links === 'object', 'student.links should be an object');
    assert.ok('github' in s.links, 'links.github should exist');
    assert.ok('linkedin' in s.links, 'links.linkedin should exist');

    assert.ok(s.attendance && typeof s.attendance === 'object', 'student.attendance should be an object');
    assert.equal(typeof s.attendance.lectures, 'number', 'attendance.lectures should be number');
    assert.equal(typeof s.attendance.meetings, 'number', 'attendance.meetings should be number');
    assert.equal(typeof s.attendance.officeHours, 'number', 'attendance.officeHours should be number');

    assert.ok(s.activity && typeof s.activity === 'object', 'student.activity should be an object');
    assert.ok(Array.isArray(s.activity.punchCard), 'activity.punchCard should be an array');
  }
}

// Mock payloads (aligned with api-contracts.md) ------------------------------

const mockProfessorPayload = {
  offeringId: 'cse210-fa25',
  professors: [
    {
      userId: 'uuid-prof-1',
      name: 'John Smith',
      preferredName: 'John',
      pronouns: null,
      photo: null,
      email: 'jsmith@ucsd.edu',
      phone: null,
      links: {
        linkedin: null,
        github: null,
        office_hours: null,
        class_chat: null
      },
      availability: []
    }
  ]
};

const mockProfessorEmpty = {
  offeringId: 'cse210-fa25',
  professors: []
};

const mockTasPayload = {
  offeringId: 'cse210-fa25',
  tas: [
    {
      userId: 'uuid-ta-1',
      name: 'Alice Chen',
      preferredName: 'Alice',
      pronouns: null,
      photo: null,
      email: 'alice@ucsd.edu',
      section: null,
      role: 'TA',
      links: {
        linkedin: null,
        github: null,
        class_chat: null
      },
      availability: [],
      activity: null
    }
  ]
};

const mockTasEmpty = {
  offeringId: 'cse210-fa25',
  tas: []
};

const mockSingleTaPayload = {
  userId: 'uuid-ta-1',
  name: 'Alice Chen',
  preferredName: 'Alice',
  pronouns: null,
  photo: null,
  email: 'alice@ucsd.edu',
  section: null,
  role: 'TA',
  links: {
    linkedin: null,
    github: null,
    class_chat: null
  },
  availability: [],
  activity: null
};

const mockStudentsPayload = {
  offeringId: 'cse210-fa25',
  students: [
    {
      userId: 'uuid-student-1',
      name: 'Andy Cheng',
      preferredName: 'Andy',
      pronouns: null,
      photo: null,
      email: 'andy@ucsd.edu',
      section: null,
      role: 'STUDENT',
      links: {
        github: null,
        linkedin: null
      },
      attendance: {
        lectures: 0,
        meetings: 0,
        officeHours: 0
      },
      activity: {
        punchCard: []
      }
    }
  ],
  page: 1,
  limit: 20,
  total: 1
};

const mockStudentsEmpty = {
  offeringId: 'cse210-fa25',
  students: [],
  page: 1,
  limit: 20,
  total: 0
};

// Tests ----------------------------------------------------------------------

test('Class Directory contract: professor response shape (non-empty)', () => {
  assertProfessorResponse(mockProfessorPayload);
});

test('Class Directory contract: professor response shape (empty list)', () => {
  // Should not throw when professors array is empty
  assertProfessorResponse(mockProfessorEmpty);
});

test('Class Directory contract: tas response shape (non-empty)', () => {
  assertTasResponse(mockTasPayload);
});

test('Class Directory contract: tas response shape (empty list)', () => {
  // Should not throw when tas array is empty
  assertTasResponse(mockTasEmpty);
});

test('Class Directory contract: single TA response shape', () => {
  assertSingleTaResponse(mockSingleTaPayload);
});

test('Class Directory contract: students response shape (non-empty)', () => {
  assertStudentsResponse(mockStudentsPayload);
});

test('Class Directory contract: students response shape (empty list)', () => {
  // Should not throw when students array is empty
  assertStudentsResponse(mockStudentsEmpty);
});
