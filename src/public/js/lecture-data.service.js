/**
 * Mock data + helper methods for the lecture attendance prototype.
 * Replace these functions with real API calls once backend endpoints exist.
 */
(function initLectureService() {
  const MOCK_TEAMS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];

  const baseLectures = [
    {
      id: 'lec-15',
      courseId: 'cse210',
      label: 'Lecture 15',
      attendancePercent: 85,
      status: 'open',
      startsAt: '2024-12-15T10:00:00',
      endsAt: '2024-12-15T11:20:00',
      questions: [
        {
          id: 'lec-15-q1',
          prompt: 'Summarize your thoughts on Farley chapters 1-2 in 2-3 sentences',
          type: 'text'
        },
        {
          id: 'lec-15-q2',
          prompt: 'More questions, based on what professor created for this lecture',
          type: 'text'
        },
        {
          id: 'lec-15-q3',
          prompt: 'How confident do you feel about today’s topic?',
          type: 'pulse',
          options: ['Not yet', 'Warming up', 'Solid']
        }
      ],
      accessCode: '642913'
    },
    {
      id: 'lec-14',
      courseId: 'cse210',
      label: 'Lecture 14',
      attendancePercent: 88,
      status: 'closed',
      startsAt: '2024-12-13T10:00:00',
      endsAt: '2024-12-13T11:20:00',
      questions: [
        {
          id: 'lec-14-q1',
          prompt: 'List one takeaway from the prototyping demo',
          type: 'text'
        },
        {
          id: 'lec-14-q2',
          prompt: 'Which tool felt the most productive today?',
          type: 'mcq',
          options: ['Figma', 'CodeSandbox', 'Notion', 'Other']
        }
      ],
      accessCode: '118430'
    },
    {
      id: 'lec-13',
      courseId: 'cse210',
      label: 'Lecture 13',
      attendancePercent: 90,
      status: 'closed',
      startsAt: '2024-12-11T10:00:00',
      endsAt: '2024-12-11T11:20:00',
      questions: [
        {
          id: 'lec-13-q1',
          prompt: 'Rate your comfort with state machines after today (1-5)',
          type: 'pulse',
          options: ['1', '2', '3', '4', '5']
        }
      ],
      accessCode: '508723'
    },
    {
      id: 'lec-12',
      courseId: 'cse210',
      label: 'Lecture 12',
      attendancePercent: 76,
      status: 'closed',
      startsAt: '2024-12-09T10:00:00',
      endsAt: '2024-12-09T11:20:00',
      questions: [],
      accessCode: '840193'
    }
  ];

  const studentLectureStatus = {
    'student-1': {
      'lec-15': 'open',
      'lec-14': 'present',
      'lec-13': 'absent',
      'lec-12': 'present'
    }
  };

  const responseBank = {
    'lec-15-q1': [
      { studentId: 'stu-01', name: 'Mila Carter', team: 'Alpha', response: 'Farley illustrates how iteration shortens decision cycles and codifies shared understanding.' },
      { studentId: 'stu-02', name: 'Jon Patel', team: 'Bravo', response: 'Loved the emphasis on decoupling. The chapter made the QR attendance idea feel feasible.' }
    ],
    'lec-15-q2': [
      { studentId: 'stu-01', name: 'Mila Carter', team: 'Alpha', response: 'Could we see another example of story slicing with metrics?' },
      { studentId: 'stu-03', name: 'Lena Ortiz', team: 'Charlie', response: 'Can we clarify how to pick between real-time and asynchronous check-ins?' }
    ],
    'lec-15-q3': [
      { studentId: 'stu-02', name: 'Jon Patel', team: 'Bravo', response: 'Solid' },
      { studentId: 'stu-04', name: 'Noah Reed', team: 'Delta', response: 'Warming up' }
    ],
    'lec-14-q1': [
      { studentId: 'stu-05', name: 'Ivy Zhang', team: 'Echo', response: 'We should prototype the access code entry card with a short validation loop.' }
    ]
  };

  function clone(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function buildHistory() {
    return baseLectures
      .slice()
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
      .map((lecture, index) => ({
        ...lecture,
        position: index + 1
      }));
  }

  function getLectureById(id) {
    const match = baseLectures.find((lecture) => lecture.id === id);
    return match ? clone(match) : null;
  }

  function getCurrentLecture(courseId) {
    return baseLectures.find((lecture) => lecture.courseId === courseId && lecture.status === 'open');
  }

  window.LectureService = {
    getInstructorOverview(courseId = 'cse210') {
      const history = buildHistory().reverse();
      const current = getCurrentLecture(courseId);
      return {
        summaryPercent: history[0]?.attendancePercent ?? 0,
        history,
        lectures: history,
        currentLectureId: current?.id ?? null
      };
    },

    getLectureWithQuestions(lectureId) {
      return getLectureById(lectureId);
    },

    getQuestionResponses(lectureId, questionId) {
      const lecture = getLectureById(lectureId);
      if (!lecture) return [];
      if (!questionId) {
        return lecture.questions.length
          ? this.getQuestionResponses(lectureId, lecture.questions[0].id)
          : [];
      }
      return clone(responseBank[questionId] ?? []);
    },

    deleteLecture(lectureId) {
      const index = baseLectures.findIndex((lecture) => lecture.id === lectureId);
      if (index > -1) {
        baseLectures.splice(index, 1);
        Object.keys(studentLectureStatus).forEach((studentId) => {
          delete studentLectureStatus[studentId][lectureId];
        });
      }
    },

    createLecture(payload) {
      const newLectureId = `lec-${Math.floor(Math.random() * 900 + 100)}`;
      const accessCode = `${Math.floor(Math.random() * 900000 + 100000)}`;
      const lecture = {
        id: newLectureId,
        courseId: payload.courseId || 'cse210',
        label: payload.label || `Lecture ${baseLectures.length + 1}`,
        attendancePercent: 0,
        status: 'open',
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        questions: payload.questions || [],
        accessCode
      };

      baseLectures.unshift(lecture);
      return clone(lecture);
    },

    recordStudentResponses({ studentId = 'student-1', lectureId, answers }) {
      if (!lectureId || !answers?.length) return { success: false };
      answers.forEach(({ questionId, response }) => {
        if (!responseBank[questionId]) {
          responseBank[questionId] = [];
        }

        const existingIndex = responseBank[questionId].findIndex((res) => res.studentId === studentId);
        const entry = {
          studentId,
          name: 'You',
          team: MOCK_TEAMS[Math.floor(Math.random() * MOCK_TEAMS.length)],
          response
        };

        if (existingIndex > -1) {
          responseBank[questionId][existingIndex] = entry;
        } else {
          responseBank[questionId].push(entry);
        }
      });

      if (!studentLectureStatus[studentId]) {
        studentLectureStatus[studentId] = {};
      }
      studentLectureStatus[studentId][lectureId] = 'present';

      return { success: true };
    },

    getStudentLectureList(studentId = 'student-1') {
      const overview = this.getInstructorOverview().lectures;
      const statusMap = studentLectureStatus[studentId] ?? {};

      return overview.map((lecture) => {
        let statusLabel = statusMap[lecture.id] || (lecture.status === 'open' ? 'open' : 'absent');
        if (lecture.status === 'closed' && statusLabel === 'open') statusLabel = 'absent';
        return {
          id: lecture.id,
          label: lecture.label,
          status: statusLabel,
          sessionState: lecture.status,
          startsAt: lecture.startsAt,
          endsAt: lecture.endsAt
        };
      });
    },

    hasStudentSubmittedResponses(studentId = 'student-1', lectureId) {
      const statusMap = studentLectureStatus[studentId] ?? {};
      return statusMap[lectureId] === 'present';
    }
  };
})();

