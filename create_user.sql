INSERT INTO auth.users (email, password, email_verified, profile, metadata)
VALUES (
  '197007012003121004@smaga.id',
  crypt('197007012003121004', gen_salt('bf')),
  true,
  '{"full_name": "H. Y. Yulianto, S.Pd", "role": "guru", "jenjang": "sma"}',
  '{"full_name": "H. Y. Yulianto, S.Pd", "role": "guru", "jenjang": "sma"}'
)
RETURNING id, email, email_verified, profile, metadata;