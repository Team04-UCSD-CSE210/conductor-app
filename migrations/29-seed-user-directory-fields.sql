-- 29-seed-user-directory-fields.sql
-- Seed data for user directory profile fields

DO $$
BEGIN
  -- Update instructors with directory profile information
  UPDATE users
  SET
    pronunciation = CASE 
      WHEN email = 'bhchandna@ucsd.edu' THEN 'AL-iss SMITH'
      WHEN email = 'lhardy@ucsd.edu' THEN 'AL-iss SMITH'
      WHEN email = 'instructor2@ucsd.edu' THEN 'BOB LEE'
      WHEN email = 'instructor3@ucsd.edu' THEN 'KAR-ul CHEN'
      WHEN email = 'instructor4@ucsd.edu' THEN 'DAY-vid KIM'
      WHEN email = 'zhkan@ucsd.edu' THEN 'GAD'
      WHEN email = 'haxing@ucsd.edu' THEN 'HAI-yee'
      ELSE NULL
    END,
    availability_general = CASE 
      WHEN email IN ('bhchandna@ucsd.edu', 'lhardy@ucsd.edu', 'zhkan@ucsd.edu', 'haxing@ucsd.edu') THEN 'Office hours: Mon/Wed 2-4pm, or by appointment'
      WHEN email = 'instructor2@ucsd.edu' THEN 'Office hours: Tue/Thu 1-3pm'
      WHEN email = 'instructor3@ucsd.edu' THEN 'Office hours: Mon 10am-12pm, Wed 2-4pm'
      WHEN email = 'instructor4@ucsd.edu' THEN 'Available by appointment only'
      ELSE NULL
    END,
    availability_specific = CASE 
      WHEN email IN ('bhchandna@ucsd.edu', 'lhardy@ucsd.edu') THEN 
        '{"office_hours": [{"day": "Monday", "start": "14:00", "end": "16:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "CSE Building, Room 4204", "appointment_required": false}'::jsonb
      WHEN email = 'instructor2@ucsd.edu' THEN 
        '{"office_hours": [{"day": "Tuesday", "start": "13:00", "end": "15:00"}, {"day": "Thursday", "start": "13:00", "end": "15:00"}], "location": "ECE Building, Room 2101", "appointment_required": false}'::jsonb
      WHEN email = 'instructor3@ucsd.edu' THEN 
        '{"office_hours": [{"day": "Monday", "start": "10:00", "end": "12:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "CSE Building, Room 3102", "appointment_required": false}'::jsonb
      WHEN email = 'instructor4@ucsd.edu' THEN 
        '{"office_hours": [], "location": "Data Science Building, Room 1501", "appointment_required": true}'::jsonb
      WHEN email = 'zhkan@ucsd.edu' THEN 
        '{"office_hours": [{"day": "Monday", "start": "14:00", "end": "16:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "Data Science Building, Room 2201", "appointment_required": false}'::jsonb
      WHEN email = 'haxing@ucsd.edu' THEN 
        '{"office_hours": [{"day": "Monday", "start": "14:00", "end": "16:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "CSE Building, Room 4204", "appointment_required": false}'::jsonb
      ELSE NULL
    END,
    class_chat = CASE 
      WHEN email IN ('bhchandna@ucsd.edu', 'lhardy@ucsd.edu', 'zhkan@ucsd.edu', 'haxing@ucsd.edu') THEN 'cse210-instructors'
      WHEN email = 'instructor2@ucsd.edu' THEN 'ece210-instructors'
      WHEN email = 'instructor3@ucsd.edu' THEN 'cse210-instructors'
      WHEN email = 'instructor4@ucsd.edu' THEN 'ds210-instructors'
      ELSE NULL
    END,
    slack_handle = CASE 
      WHEN email = 'bhchandna@ucsd.edu' THEN '@alice.smith'
      WHEN email = 'lhardy@ucsd.edu' THEN '@alice.smith'
      WHEN email = 'instructor2@ucsd.edu' THEN '@bob.lee'
      WHEN email = 'instructor3@ucsd.edu' THEN '@carol.chen'
      WHEN email = 'instructor4@ucsd.edu' THEN '@david.kim'
      WHEN email = 'zhkan@ucsd.edu' THEN '@gad'
      WHEN email = 'haxing@ucsd.edu' THEN '@haiyi'
      ELSE NULL
    END
  WHERE email IN (
    'bhchandna@ucsd.edu', 'lhardy@ucsd.edu', 'instructor2@ucsd.edu', 
    'instructor3@ucsd.edu', 'instructor4@ucsd.edu', 'zhkan@ucsd.edu', 'haxing@ucsd.edu'
  );

  -- Update TAs (graduate students) with directory profile information
  UPDATE users
  SET
    pronunciation = CASE 
      WHEN email = 'grad1@ucsd.edu' THEN 'CHAR-lee GREEN'
      WHEN email = 'grad2@ucsd.edu' THEN 'dee-AH-na mar-TEE-nez'
      WHEN email = 'grad3@ucsd.edu' THEN 'EE-than WONG'
      ELSE NULL
    END,
    availability_general = CASE 
      WHEN email = 'grad1@ucsd.edu' THEN 'TA office hours: Tue/Thu 11am-1pm'
      WHEN email = 'grad2@ucsd.edu' THEN 'TA office hours: Mon/Wed 3-5pm'
      WHEN email = 'grad3@ucsd.edu' THEN 'TA office hours: Fri 10am-12pm'
      ELSE NULL
    END,
    availability_specific = CASE 
      WHEN email = 'grad1@ucsd.edu' THEN 
        '{"office_hours": [{"day": "Tuesday", "start": "11:00", "end": "13:00"}, {"day": "Thursday", "start": "11:00", "end": "13:00"}], "location": "CSE Building, Room 1202", "appointment_required": false}'::jsonb
      WHEN email = 'grad2@ucsd.edu' THEN 
        '{"office_hours": [{"day": "Monday", "start": "15:00", "end": "17:00"}, {"day": "Wednesday", "start": "15:00", "end": "17:00"}], "location": "CSE Building, Room 1202", "appointment_required": false}'::jsonb
      WHEN email = 'grad3@ucsd.edu' THEN 
        '{"office_hours": [{"day": "Friday", "start": "10:00", "end": "12:00"}], "location": "Data Science Building, Room 1502", "appointment_required": false}'::jsonb
      ELSE NULL
    END,
    class_chat = CASE 
      WHEN email IN ('grad1@ucsd.edu', 'grad2@ucsd.edu') THEN 'cse210-tas'
      WHEN email = 'grad3@ucsd.edu' THEN 'ds210-tas'
      ELSE NULL
    END,
    slack_handle = CASE 
      WHEN email = 'grad1@ucsd.edu' THEN '@charlie.green'
      WHEN email = 'grad2@ucsd.edu' THEN '@diana.martinez'
      WHEN email = 'grad3@ucsd.edu' THEN '@ethan.wong'
      ELSE NULL
    END
  WHERE email IN ('grad1@ucsd.edu', 'grad2@ucsd.edu', 'grad3@ucsd.edu');

  -- Update some students with directory profile information
  UPDATE users
  SET
    pronunciation = CASE 
      WHEN email = 'student1@ucsd.edu' THEN 'FRANK MIL-ler'
      WHEN email = 'student2@ucsd.edu' THEN 'GRAYCE CHEN'
      WHEN email = 'student3@ucsd.edu' THEN 'HEN-ree WIL-son'
      WHEN email = 'student4@ucsd.edu' THEN 'iz-ah-BEL-la gar-SEE-ah'
      WHEN email = 'student5@ucsd.edu' THEN 'JACK THOM-son'
      WHEN email = 'student6@ucsd.edu' THEN 'KAT-uh-rin LEE'
      WHEN email = 'student7@ucsd.edu' THEN 'LEE-um BROWN'
      WHEN email = 'student8@ucsd.edu' THEN 'MEE-ah DAY-vis'
      WHEN email = 'hhundhausen@ucsd.edu' THEN 'heh-LAY-nah BEN-der'
      ELSE NULL
    END,
    availability_general = CASE 
      WHEN email IN ('student1@ucsd.edu', 'student2@ucsd.edu', 'student3@ucsd.edu') THEN 'Available for study groups'
      WHEN email IN ('student4@ucsd.edu', 'student5@ucsd.edu', 'student6@ucsd.edu') THEN 'Usually available evenings'
      ELSE NULL
    END,
    class_chat = CASE 
      WHEN email LIKE 'student%@ucsd.edu' THEN 'cse210-students'
      WHEN email = 'hhundhausen@ucsd.edu' THEN 'cse210-students'
      ELSE NULL
    END,
    slack_handle = CASE 
      WHEN email = 'student1@ucsd.edu' THEN '@frank.miller'
      WHEN email = 'student2@ucsd.edu' THEN '@grace.chen'
      WHEN email = 'student3@ucsd.edu' THEN '@henry.wilson'
      WHEN email = 'student4@ucsd.edu' THEN '@isabella.garcia'
      WHEN email = 'student5@ucsd.edu' THEN '@jack.thompson'
      WHEN email = 'student6@ucsd.edu' THEN '@katherine.lee'
      WHEN email = 'student7@ucsd.edu' THEN '@liam.brown'
      WHEN email = 'student8@ucsd.edu' THEN '@mia.davis'
      WHEN email = 'hhundhausen@ucsd.edu' THEN '@helena.bender'
      ELSE NULL
    END
  WHERE email IN (
    'student1@ucsd.edu', 'student2@ucsd.edu', 'student3@ucsd.edu', 
    'student4@ucsd.edu', 'student5@ucsd.edu', 'student6@ucsd.edu',
    'student7@ucsd.edu', 'student8@ucsd.edu', 'hhundhausen@ucsd.edu'
  );

  -- Update extension students
  UPDATE users
  SET
    pronunciation = CASE 
      WHEN email = 'bhavikchandna@gmail.com' THEN 'NO-ah AN-der-son'
      WHEN email = 'liamhardy2004@gmail.com' THEN 'NO-ah AN-der-son'
      WHEN email = 'bgyawali@ucsd.edu' THEN 'BEE-mal RAJ GYAH-wah-lee'
      WHEN email = 'kanzhekanzhe1@gmail.com' THEN 'ZHE KAN'
      WHEN email = 'jackkanzhe@gmail.com' THEN 'JACK KAN'
      ELSE NULL
    END,
    class_chat = CASE 
      WHEN email LIKE '%@gmail.com' OR email LIKE '%@yahoo.com' OR email LIKE '%@outlook.com' THEN 'cse210-extension'
      ELSE NULL
    END,
    slack_handle = CASE 
      WHEN email = 'bhavikchandna@gmail.com' THEN '@noah.anderson'
      WHEN email = 'liamhardy2004@gmail.com' THEN '@noah.anderson'
      WHEN email = 'bgyawali@ucsd.edu' THEN '@bimal.gyawali'
      WHEN email = 'kanzhekanzhe1@gmail.com' THEN '@zhe.kan'
      WHEN email = 'jackkanzhe@gmail.com' THEN '@jack.kan'
      ELSE NULL
    END
  WHERE email IN (
    'bhavikchandna@gmail.com', 'liamhardy2004@gmail.com', 'bgyawali@ucsd.edu',
    'haiyix1@gmail.com', 'kanzhekanzhe1@gmail.com', 'jackkanzhe@gmail.com',
    'extension2@gmail.com', 'extension3@yahoo.com', 'extension4@gmail.com', 'extension5@outlook.com'
  );

  RAISE NOTICE 'Updated user directory profile fields';
END $$;

