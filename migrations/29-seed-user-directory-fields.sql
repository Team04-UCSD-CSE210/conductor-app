-- 29-seed-user-directory-fields.sql
-- Seed data for user directory profile fields

DO $$
DECLARE
    email_bhchandna CONSTANT TEXT := 'bhchandna@ucsd.edu';
    email_lhardy CONSTANT TEXT := 'lhardy@ucsd.edu';
    email_instructor2 CONSTANT TEXT := 'instructor2@ucsd.edu';
    email_instructor3 CONSTANT TEXT := 'instructor3@ucsd.edu';
    email_instructor4 CONSTANT TEXT := 'instructor4@ucsd.edu';
    email_zhkan CONSTANT TEXT := 'zhkan@ucsd.edu';
    email_haxing CONSTANT TEXT := 'haxing@ucsd.edu';
    email_grad1 CONSTANT TEXT := 'grad1@ucsd.edu';
    email_grad2 CONSTANT TEXT := 'grad2@ucsd.edu';
    email_grad3 CONSTANT TEXT := 'grad3@ucsd.edu';
    email_student1 CONSTANT TEXT := 'student1@ucsd.edu';
    email_student2 CONSTANT TEXT := 'student2@ucsd.edu';
    email_student3 CONSTANT TEXT := 'student3@ucsd.edu';
    email_student4 CONSTANT TEXT := 'student4@ucsd.edu';
    email_student5 CONSTANT TEXT := 'student5@ucsd.edu';
    email_student6 CONSTANT TEXT := 'student6@ucsd.edu';
    email_student7 CONSTANT TEXT := 'student7@ucsd.edu';
    email_student8 CONSTANT TEXT := 'student8@ucsd.edu';
    email_hhundhausen CONSTANT TEXT := 'hhundhausen@ucsd.edu';
BEGIN
  -- Update instructors with directory profile information
  UPDATE users
  SET
    pronunciation = CASE 
      WHEN email = email_bhchandna THEN 'AL-iss SMITH'
      WHEN email = email_lhardy THEN 'AL-iss SMITH'
      WHEN email = email_instructor2 THEN 'BOB LEE'
      WHEN email = email_instructor3 THEN 'KAR-ul CHEN'
      WHEN email = email_instructor4 THEN 'DAY-vid KIM'
      WHEN email = email_zhkan THEN 'GAD'
      WHEN email = email_haxing THEN 'HAI-yee'
      ELSE NULL
    END,
    availability_general = CASE 
      WHEN email IN (email_bhchandna, email_lhardy, email_zhkan, email_haxing) THEN 'Office hours: Mon/Wed 2-4pm, or by appointment'
      WHEN email = email_instructor2 THEN 'Office hours: Tue/Thu 1-3pm'
      WHEN email = email_instructor3 THEN 'Office hours: Mon 10am-12pm, Wed 2-4pm'
      WHEN email = email_instructor4 THEN 'Available by appointment only'
      ELSE NULL
    END,
    availability_specific = CASE 
      WHEN email IN (email_bhchandna, email_lhardy) THEN 
        '{"office_hours": [{"day": "Monday", "start": "14:00", "end": "16:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "CSE Building, Room 4204", "appointment_required": false}'::jsonb
      WHEN email = email_instructor2 THEN 
        '{"office_hours": [{"day": "Tuesday", "start": "13:00", "end": "15:00"}, {"day": "Thursday", "start": "13:00", "end": "15:00"}], "location": "ECE Building, Room 2101", "appointment_required": false}'::jsonb
      WHEN email = email_instructor3 THEN
        '{"office_hours": [{"day": "Monday", "start": "10:00", "end": "12:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "CSE Building, Room 3102", "appointment_required": false}'::jsonb
      WHEN email = email_instructor4 THEN 
        '{"office_hours": [], "location": "Data Science Building, Room 1501", "appointment_required": true}'::jsonb
      WHEN email = email_zhkan THEN 
        '{"office_hours": [{"day": "Monday", "start": "14:00", "end": "16:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "Data Science Building, Room 2201", "appointment_required": false}'::jsonb
      WHEN email = email_haxing THEN 
        '{"office_hours": [{"day": "Monday", "start": "14:00", "end": "16:00"}, {"day": "Wednesday", "start": "14:00", "end": "16:00"}], "location": "CSE Building, Room 4204", "appointment_required": false}'::jsonb
      ELSE NULL
    END,
    class_chat = CASE 
      WHEN email IN (email_bhchandna, email_lhardy, email_zhkan, email_haxing) THEN 'cse210-instructors'
      WHEN email = email_instructor2 THEN 'ece210-instructors'
      WHEN email = email_instructor3 THEN 'cse210-instructors'
      WHEN email = email_instructor4 THEN 'ds210-instructors'
      ELSE NULL
    END,
    slack_handle = CASE 
      WHEN email = email_bhchandna THEN '@alice.smith'
      WHEN email = email_lhardy THEN '@alice.smith'
      WHEN email = email_instructor2 THEN '@bob.lee'
      WHEN email = email_instructor3 THEN '@carol.chen'
      WHEN email = email_instructor4 THEN '@david.kim'
      WHEN email = email_zhkan THEN '@gad'
      WHEN email = email_haxing THEN '@haiyi'
      ELSE NULL
    END
  WHERE email IN (
    email_bhchandna, email_lhardy, email_instructor2, 
    email_instructor3, email_instructor4, email_zhkan, email_haxing
  );

  -- Update TAs (graduate students) with directory profile information
  UPDATE users
  SET
    pronunciation = CASE 
      WHEN email = email_grad1 THEN 'CHAR-lee GREEN'
      WHEN email = email_grad2 THEN 'dee-AH-na mar-TEE-nez'
      WHEN email = email_grad3 THEN 'EE-than WONG'
      ELSE NULL
    END,
    availability_general = CASE 
      WHEN email = email_grad1 THEN 'TA office hours: Tue/Thu 11am-1pm'
      WHEN email = email_grad2 THEN 'TA office hours: Mon/Wed 3-5pm'
      WHEN email = email_grad3 THEN 'TA office hours: Fri 10am-12pm'
      ELSE NULL
    END,
    availability_specific = CASE 
      WHEN email = email_grad1 THEN 
        '{"office_hours": [{"day": "Tuesday", "start": "11:00", "end": "13:00"}, {"day": "Thursday", "start": "11:00", "end": "13:00"}], "location": "CSE Building, Room 1202", "appointment_required": false}'::jsonb
      WHEN email = email_grad2 THEN 
        '{"office_hours": [{"day": "Monday", "start": "15:00", "end": "17:00"}, {"day": "Wednesday", "start": "15:00", "end": "17:00"}], "location": "CSE Building, Room 1202", "appointment_required": false}'::jsonb
      WHEN email = email_grad3 THEN 
        '{"office_hours": [{"day": "Friday", "start": "10:00", "end": "12:00"}], "location": "Data Science Building, Room 1502", "appointment_required": false}'::jsonb
      ELSE NULL
    END,
    class_chat = CASE 
      WHEN email IN (email_grad1, email_grad2) THEN 'cse210-tas'
      WHEN email = email_grad3 THEN 'ds210-tas'
      ELSE NULL
    END,
    slack_handle = CASE 
      WHEN email = email_grad1 THEN '@charlie.green'
      WHEN email = email_grad2 THEN '@diana.martinez'
      WHEN email = email_grad3 THEN '@ethan.wong'
      ELSE NULL
    END
  WHERE email IN (email_grad1, email_grad2, email_grad3);

  -- Update some students with directory profile information
  UPDATE users
  SET
    pronunciation = CASE 
      WHEN email = email_student1 THEN 'FRANK MIL-ler'
      WHEN email = email_student2 THEN 'GRAYCE CHEN'
      WHEN email = email_student3 THEN 'HEN-ree WIL-son'
      WHEN email = email_student4 THEN 'iz-ah-BEL-la gar-SEE-ah'
      WHEN email = email_student5 THEN 'JACK THOM-son'
      WHEN email = email_student6 THEN 'KAT-uh-rin LEE'
      WHEN email = email_student7 THEN 'LEE-um BROWN'
      WHEN email = email_student8 THEN 'MEE-ah DAY-vis'
      WHEN email = email_hhundhausen THEN 'heh-LAY-nah BEN-der'
      ELSE NULL
    END,
    availability_general = CASE 
      WHEN email IN (email_student1, email_student2, email_student3) THEN 'Available for study groups'
      WHEN email IN (email_student4, email_student5, email_student6) THEN 'Usually available evenings'
      ELSE NULL
    END,
    class_chat = CASE 
      WHEN email >= 'student@ucsd.edu' AND email < 'studenz@ucsd.edu' THEN 'cse210-students'
      WHEN email = email_hhundhausen THEN 'cse210-students'
      ELSE NULL
    END,
    slack_handle = CASE 
      WHEN email = email_student1 THEN '@frank.miller'
      WHEN email = email_student2 THEN '@grace.chen'
      WHEN email = email_student3 THEN '@henry.wilson'
      WHEN email = email_student4 THEN '@isabella.garcia'
      WHEN email = email_student5 THEN '@jack.thompson'
      WHEN email = email_student6 THEN '@katherine.lee'
      WHEN email = email_student7 THEN '@liam.brown'
      WHEN email = email_student8 THEN '@mia.davis'
      WHEN email = email_hhundhausen THEN '@helena.bender'
      ELSE NULL
    END
  WHERE email IN (
    email_student1, email_student2, email_student3, 
    email_student4, email_student5, email_student6,
    email_student7, email_student8, email_hhundhausen
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

