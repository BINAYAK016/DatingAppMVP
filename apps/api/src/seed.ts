import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth";
import { one, tx } from "./db";
export const demoIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
];
export async function seed() {
  if (process.env.ENABLE_DEMO !== "true") return;
  await tx(async (db) => {
    if (await one(db, "SELECT 1 FROM users LIMIT 1")) return;
    const people = [
      [
        "Aarav",
        "Kathmandu",
        "Finding beauty in small things. Coffee, old bookshops, and trails with no signal.",
        "Coffee,Hiking,Photography",
        "The quickest way to my heart? Remember my coffee order.",
        "Man",
        "#DDE7C9",
      ],
      [
        "Anaya",
        "Lalitpur",
        "A little art, a little adventure. Usually planning my next pottery class.",
        "Art,Coffee,Travel",
        "My perfect Sunday: a slow morning and a spontaneous plan.",
        "Woman",
        "#F2D7CC",
      ],
      [
        "Samira",
        "Kathmandu",
        "Momos are a love language. Tell me about the last thing that made you laugh.",
        "Food,Music,Hiking",
        "Together we could finally try that tiny café everyone talks about.",
        "Woman",
        "#D5DFEF",
      ],
      [
        "Rohan",
        "Sydney",
        "Nepali roots, coastal weekends. Always up for a good story and a long walk.",
        "Travel,Music,Coffee",
        "I will absolutely make you a playlist.",
        "Man",
        "#E7DCF0",
      ],
      [
        "Nisha",
        "Pokhara",
        "Lakeside sunsets, books with bent corners, and a little curiosity.",
        "Reading,Art,Hiking",
        "A small joy: rain on the roof while the kettle boils.",
        "Woman",
        "#F2E5C1",
      ],
    ];
    for (let i = 0; i < people.length; i++) {
      const [name, city, bio, interests, prompt, gender, color] = people[i];
      await db.query(
        `INSERT INTO users(id,email,password_hash,name,birth_date,city,bio,interests,prompt,gender,color,demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)`,
        [
          demoIds[i],
          `demo${i + 1}@sangai.invalid`,
          hashPassword(randomUUID()),
          name,
          "1998-04-14",
          city,
          bio,
          interests.split(","),
          prompt,
          gender,
          color,
        ],
      );
    }
    await db.query(
      "UPDATE users SET email_verified_at=now(),adult_declared_at=now(),onboarded_at=now(),onboarding_step=5 WHERE demo",
    );
    for (const [i, j] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ])
      await db.query(
        "INSERT INTO connections(a,b,sender,state) VALUES($1,$2,$1,'matched')",
        [demoIds[i], demoIds[j]],
      );
    const posts = [
      [
        "1",
        "Found a little corner of calm in Patan today. What is your favorite place to slow down?",
      ],
      [
        "2",
        "Important question: steamed momos or fried momos? There is a correct answer. 🥟",
      ],
      [
        "0",
        "A Sunday well spent: one new trail, two cups of coffee, and absolutely no agenda.",
      ],
    ];
    for (const [i, body] of posts)
      await db.query("INSERT INTO posts(id,author,body) VALUES($1,$2,$3)", [
        randomUUID(),
        demoIds[Number(i)],
        body,
      ]);
    await db.query("INSERT INTO stories(id,author,body) VALUES($1,$2,$3)", [
      randomUUID(),
      demoIds[1],
      "Little moments, good company. A pottery kind of afternoon.",
    ]);
    await db.query(
      "INSERT INTO messages(id,sender,recipient,body,client_id) VALUES($1,$2,$3,$4,$5)",
      [
        randomUUID(),
        demoIds[1],
        demoIds[0],
        "Hey! You had me at old bookshops. Found any good ones lately?",
        "seed-hello",
      ],
    );
  });
}
