import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";

const getAI = () => {
    const apiKey = process.env.API_KEY || ''; // In a real app, ensure this is handled securely
    if (!apiKey) console.warn("Gemini API Key missing");
    return new GoogleGenAI({ apiKey });
}

export const generateQuestionFromTopic = async (topic: string, type: QuestionType): Promise<Partial<Question> | null> => {
  try {
    const ai = getAI();
    // Using gemini-3-flash-preview for fast generation
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Create a ${type} question about "${topic}" for junior high school (SMP) level. 
      Return JSON with fields: stimulus (text context), text (question), options (array of strings if applicable), correctAnswerIndex (number).`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stimulus: { type: Type.STRING },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswerIndex: { type: Type.INTEGER }
          }
        }
      }
    });
    
    if (response.text) {
        return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

export const analyzeResults = async (resultsSummary: string): Promise<string> => {
    try {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze these exam results and provide a brief summary of student performance, weak areas, and suggestions for the teacher: ${resultsSummary}`
        });
        return response.text || "Analysis failed.";
    } catch (error) {
        return "Could not perform analysis. Check API Key.";
    }
}
