const express = require("express");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");

dotenv.config();

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const app = express();


app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY)
    });
});



app.get("/api/test-gemini", async (req, res) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Suggest 3 simple tasks to prepare for a hackathon."
        });

        res.json({
            success: true,
            message: response.text
        });

    } catch (error) {
        console.error("Gemini API error:", error);

        res.status(500).json({
            success: false,
            error: "Failed to generate a response from Gemini."
        });
    }
});


app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
