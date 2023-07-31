const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
// MONGODB_URI=mongodb+srv://anujamongo:mongo123@cluster0.ojf2onr.mongodb.net/bookapp
const app = express();
app.use(express.json());
app.use(cors());
const dbPath = path.join(__dirname, "bookapp.db");

let db = null;

// Server and db
const initializeAndConnect = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const PORT = process.env.PORT || 5000; // Use the provided port or fallback to 5000
    app.listen(PORT, () => {
      console.log(`Server running at port ${PORT}`);
      console.log("Database sqlite connected...");
    });
  } catch (err) {
    console.log(`Db err ${err.message}`);
    process.exit(1);
  }
};
initializeAndConnect();

// Home Page

app.get("/", async (request, response) => {
  response.status(200).json({ message: "Welcome to server" });
});

// Register

app.post("/register/", async (request, response) => {
  const registerDetails = request.body;
  const { username, password, name, gender } = registerDetails;
  const checkUser = `select * from user where username = '${username}';`;
  const checkResponse = await db.get(checkUser);
  if (checkResponse !== undefined) {
    response.status(400).json({ error: "User already exists" });
  } else {
    if (password.length < 6) {
      response.status(400).json({ error: "Password is too short" });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const query1 = `insert into user(username,name,password,gender)
            values('${username}', '${name}', '${hashedPassword}', '${gender}');`;
      const responseQuery1 = await db.run(query1);
      response.status(200).json({ message: "User created successfully" });
    }
  }
});

// Login

app.post("/login/", async (request, response) => {
  const loginDetails = request.body;
  const { username, password } = loginDetails;
  const checkUser = `select * from user where username='${username}';`;
  const logUser = await db.get(checkUser);
  if (logUser === undefined) {
    response.status(400).json({ error: "Invalid User" });
  } else {
    const isPasswordMatch = await bcrypt.compare(password, logUser.password);
    if (isPasswordMatch === true) {
      const payload = {
        username: logUser.username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.status(200).json({ jwtToken: jwtToken });
    } else {
      response.status(400).json({ error: "Invalid Password" });
    }
  }
});

const verifyToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).json({ error: "Invalid JWT Token" });
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401).json({ error: "Invalid JWT Token" });
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

const getUser = async (username) => {
  try {
    const getUserDetails = `select * from user where username = ?;`;
    const userQuery = await db.get(getUserDetails, [username]);
    const userId = userQuery.id;
    return userId;
  } catch (err) {
    console.log(err);
  }
};

// Add item
app.post("/bookitem/", verifyToken, async (request, response) => {
  try {
    const { username } = request;
    const {
      id,
      title,
      authors,
      rating,
      ratingCount,
      reviewCount,
      imageUrl,
    } = request.body;

    const userId = await getUser(username);

    const checkBookQuery = `SELECT COUNT(*) AS count FROM list WHERE user_id = ? AND book_id = ?;`;
    const bookCheckResult = await db.get(checkBookQuery, [userId, id]);

    if (bookCheckResult.count > 0) {
      response.status(200).json({ message: "Already added" });
    } else {
      const insertItemQuery = `INSERT INTO list (user_id, book_id, title, author, rating, rating_count, review_count, book_img_url)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?);`;
      await db.run(insertItemQuery, [
        userId,
        id,
        title,
        authors,
        rating,
        ratingCount,
        reviewCount,
        imageUrl,
      ]);

      response.status(200).json({ message: "Item added successfully" });
    }
  } catch (error) {
    console.log(error);
    response.status(500).json({ error: "Internal server error" });
  }
});

// Books
app.get("/books", verifyToken, async (request, response) => {
  try {
    const { username } = request;
    const userId = await getUser(username);
    const listQuery = `select * from list where user_id = ?;`;
    const getList = await db.all(listQuery, [userId]);
    response.status(200).json({ list: getList });
  } catch (err) {
    response
      .status(500)
      .json({ error: "Internal Server Error", errorMsg: err });
  }
});

// Delete
app.delete("/books/:id", verifyToken, async (request, response) => {
  try {
    const { username } = request;
    const { id } = request.params;
    const userId = await getUser(username);
    const deleteQuery = `delete from list where user_id = ? and book_id = ?;`;
    await db.run(deleteQuery, [userId, id]);
    response.status(200).json({ message: "Deleted Successfully" });
  } catch (err) {
    response
      .status(500)
      .json({ error: "Internal Server Error", errorMsg: err });
  }
});
