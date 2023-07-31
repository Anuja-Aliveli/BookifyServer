require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

let db = null;

const initializeAndConnect = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    const dbOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    await mongoose.connect(MONGODB_URI, dbOptions);
    db = mongoose.connection;
    if (db.readyState === 1) {
      console.log("MongoDB connection established.");

      // Start the server only after successful connection
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`Server running at port ${PORT}`);
      });
    } else {
      console.log("MongoDB connection failed or pending.");
    }
  } catch (err) {
    console.log(`Db err ${err}`);
    process.exit(1);
  }
};

// Global error handler middleware
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({ error: "Internal server error" });
});
initializeAndConnect();

app.get("/", async (request, response) => {
  response.status(200).json({ message: "Welcome to server" });
});

// Register

app.post("/register/", async (request, response) => {
  const registerDetails = request.body;
  const { username, password, name, gender} = registerDetails;
  const usersCollection = db.collection("user");

  const existingUser = await usersCollection.findOne({ username });
  if (existingUser) {
    response.status(400).json({ error: "User already exists" });
  } else {
    if (password.length < 6) {
      response.status(400).json({ error: "Password is too short" });
    } else {
      const getUserLength = await usersCollection.find({}).toArray();
      const userId = getUserLength.length + 1;
      const hashedPassword = await bcrypt.hash(password, 10);
      const userDocument = {
        username,
        name,
        password: hashedPassword,
        gender,
        user_id: userId,
      };
      await usersCollection.insertOne(userDocument);
      response.status(200).json({ message: "User created successfully" });
    }
  }
});

// Login

app.post("/login/", async (request, response) => {
  const loginDetails = request.body;
  const { username, password } = loginDetails;
  const usersCollection = db.collection("user");
  const user = await usersCollection.findOne({ username });
  if (!user) {
    response.status(400).json({ error: "Invalid User" });
  } else {
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (isPasswordMatch) {
      const payload = {
        username: user.username,
      };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.status(200).json({ jwtToken: jwtToken });
    } else {
      response.status(400).json({ error: "Invalid Password" });
    }
  }
});

// Verify Token

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
    const usersCollection = db.collection("user");
    const userQuery = await usersCollection.findOne({ username });
    const userId = userQuery.user_id;
    return userId;
  } catch (err) {
    console.log(err);
  }
};

//bookitem
app.post("/bookitem/", verifyToken, async (request, response) => {
  try {
    const { username } = request;
    const {
      bookId,
      title,
      authors,
      rating,
      ratingCount,
      reviewCount,
      imageUrl,
    } = request.body;

    const userId = await getUser(username);

    const listCollection = db.collection("list");

    const checkBookQuery = { user_id: userId, book_id: bookId };
    const bookCheckResult = await listCollection.countDocuments(checkBookQuery);

    if (bookCheckResult > 0) {
      response.status(200).json({ message: "Already added" });
    } else {
      const bookItem = {
        user_id: userId,
        book_id: bookId,
        title,
        authors,
        rating,
        rating_count: ratingCount,
        review_count: reviewCount,
        book_img_url: imageUrl,
      };
      await listCollection.insertOne(bookItem);
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
    const listCollection = db.collection("list");
    const getList = await listCollection.find({ user_id: userId }).toArray();
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
    let { id } = request.params;
    id = parseInt(id);
    const userId = await getUser(username);
    const listCollection = db.collection("list");
    await listCollection.deleteOne({ user_id: userId, book_id: id });
    response.status(200).json({ message: "Deleted Successfully" });
  } catch (err) {
    response
      .status(500)
      .json({ error: "Internal Server Error", errorMsg: err });
  }
});
module.exports = app;
