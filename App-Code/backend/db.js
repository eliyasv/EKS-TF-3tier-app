import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connectionParams = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };

    const useDBAuth = process.env.USE_DB_AUTH === "true";
    if (useDBAuth) {
      connectionParams.user = process.env.MONGO_USERNAME;
      connectionParams.pass = process.env.MONGO_PASSWORD;
    }

    await mongoose.connect(process.env.MONGO_CONN_STR, connectionParams);
    console.log("✅ Connected to database.");

    mongoose.connection.on("connected", () => {
      console.log("MongoDB connection established.");
    });

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB connection disconnected.");
    });
  } catch (error) {
    console.error("❌ Could not connect to database.", error);
    process.exit(1);
  }
};

export default connectDB;
