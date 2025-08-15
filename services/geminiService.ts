import { GoogleGenAI, Type } from "@google/genai";
import { ResumeData, TextChunk, Experience, Education, SkillCategory, AlignmentResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const resumeSchema = {
  type: Type.OBJECT,
  properties: {
    fullName: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Array of chunk indices for the full name." },
    summary: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Array of chunk indices for the summary." },
    contact: {
      type: Type.OBJECT,
      properties: {
        phone: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Array of chunk indices for the phone number." },
        email: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Array of chunk indices for the email." },
        linkedin: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "Array of chunk indices for the LinkedIn URL." },
      },
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          degree: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          institution: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          dates: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          details: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.NUMBER } } }, // Array of arrays of indices for each bullet point
        },
      },
    },
    experience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          company: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          dates: { type: Type.ARRAY, items: { type: Type.NUMBER } },
          responsibilities: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.NUMBER } } },
        },
      },
    },
    skills: {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                categoryTitle: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                skills: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.NUMBER } } },
            }
        }
    }
  },
};

const mergeChunks = (indices: number[], allChunks: TextChunk[]): TextChunk | null => {
    if (!indices || indices.length === 0) return null;
    const relevantChunks = indices.map(i => allChunks[i]).filter(Boolean);
    if (relevantChunks.length === 0) return null;

    const mergedText = relevantChunks.map(c => c.text).join(' ');
    const firstBox = relevantChunks[0].boundingBox;
    const lastBox = relevantChunks[relevantChunks.length - 1].boundingBox;

    const mergedBox = {
        x: firstBox.x,
        y: firstBox.y,
        width: (lastBox.x + lastBox.width) - firstBox.x,
        height: Math.max(...relevantChunks.map(c => c.boundingBox.height)),
    };
    return { text: mergedText, boundingBox: mergedBox };
}

export async function parseResumeFromChunks(chunks: TextChunk[]): Promise<ResumeData> {
  try {
    const chunkTextsWithIndices = chunks.map((chunk, index) => `[${index}]: ${chunk.text}`);
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            text: `You are an expert resume parser. I will provide you with text chunks extracted from a PDF, each with a unique index. Your task is to identify which chunks belong to which section of a standard resume. Return a JSON object that maps resume fields to the corresponding chunk indices. Follow the provided schema precisely. Group related text fragments, such as a multi-line summary or a single bullet point that spans multiple lines, into the same array. For lists like responsibilities or skills, each item should be its own array of indices.`,
          },
          { text: chunkTextsWithIndices.join('\n') }
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: resumeSchema,
      },
    });

    const jsonText = response.text.trim();
    const parsedIndices = JSON.parse(jsonText);

    const resumeData: ResumeData = {
        fullName: mergeChunks(parsedIndices.fullName, chunks),
        summary: mergeChunks(parsedIndices.summary, chunks),
        contact: {
            phone: mergeChunks(parsedIndices.contact.phone, chunks),
            email: mergeChunks(parsedIndices.contact.email, chunks),
            linkedin: mergeChunks(parsedIndices.contact.linkedin, chunks),
        },
        education: parsedIndices.education.map((edu: any): Education => ({
            id: crypto.randomUUID(),
            degree: mergeChunks(edu.degree, chunks),
            institution: mergeChunks(edu.institution, chunks),
            dates: mergeChunks(edu.dates, chunks),
            details: edu.details.map((detailIndices: number[]) => mergeChunks(detailIndices, chunks)).filter(Boolean) as TextChunk[],
        })),
        experience: parsedIndices.experience.map((exp: any): Experience => ({
            id: crypto.randomUUID(),
            title: mergeChunks(exp.title, chunks),
            company: mergeChunks(exp.company, chunks),
            dates: mergeChunks(exp.dates, chunks),
            responsibilities: exp.responsibilities.map((respIndices: number[]) => mergeChunks(respIndices, chunks)).filter(Boolean) as TextChunk[],
        })),
        skills: parsedIndices.skills.map((skillCat: any): SkillCategory => ({
            categoryTitle: mergeChunks(skillCat.categoryTitle, chunks) as TextChunk, // Assuming category title is always present
            skills: skillCat.skills.map((skillIndices: number[]) => mergeChunks(skillIndices, chunks)).filter(Boolean) as TextChunk[],
        })),
    };
    
    return resumeData;
  } catch (error) {
    console.error("Error parsing resume with Gemini:", error);
    throw new Error("Failed to parse resume. The AI model might be unavailable or the document could not be processed.");
  }
}

// ... (alignmentSchema and alignWithJobDescription remain the same, but may need a helper to convert rich data to text)
const alignmentSchema = {
    type: Type.OBJECT,
    properties: {
        alignmentScore: { type: Type.NUMBER, description: "A score from 0 to 100 representing how well the resume matches the job description." },
        matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of keywords from the job description that are present in the resume." },
        missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of critical keywords from the job description that are missing from the resume." },
        suggestions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, description: "Type of suggestion: 'improve', 'add', or 'missing'." },
                    text: { type: Type.STRING, description: "The actionable suggestion text." },
                }
            },
            description: "A list of 2-3 actionable suggestions for improving the resume's alignment with the job description.",
        }
    },
    required: ["alignmentScore", "matchedKeywords", "missingKeywords", "suggestions"],
};

export async function alignWithJobDescription(resumeText: string, jobDescription: string): Promise<AlignmentResult> {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { text: `Resume Text: ${resumeText}` },
                    { text: `Job Description: ${jobDescription}` },
                    { text: "Analyze the resume against the job description. Act as an expert career coach. Provide an alignment score, identify matched and missing keywords, and offer 2-3 specific, actionable suggestions for improvement. Follow the provided JSON schema precisely." }
                ]
            },
            config: {
                responseMimeType: 'application/json',
                responseSchema: alignmentSchema,
            },
        });

        const jsonText = response.text.trim();
        const parsedData = JSON.parse(jsonText);
        return parsedData as AlignmentResult;
    } catch (error) {
        console.error("Error aligning resume with Gemini:", error);
        throw new Error("Failed to align resume. The AI model might be unavailable or the request could not be processed.");
    }
}