// Add pdfjsLib and jspdf from CDN
declare global {
  const pdfjsLib: any;
  const jspdf: any;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextChunk {
  text: string;
  boundingBox: BoundingBox;
}

export interface ContactInfo {
  phone: TextChunk | null;
  email: TextChunk | null;
  linkedin: TextChunk | null;
}

export interface Education {
  id: string;
  degree: TextChunk | null;
  institution: TextChunk | null;
  dates: TextChunk | null;
  details: TextChunk[];
}

export interface Experience {
  id:string;
  title: TextChunk | null;
  company: TextChunk | null;
  dates: TextChunk | null;
  responsibilities: TextChunk[];
}

export interface SkillCategory {
    categoryTitle: TextChunk;
    skills: TextChunk[];
}

export type Skills = SkillCategory[];


export interface ResumeData {
  fullName: TextChunk | null;
  summary: TextChunk | null;
  contact: ContactInfo;
  education: Education[];
  experience: Experience[];
  skills: Skills;
}


export interface Suggestion {
  type: 'improve' | 'add' | 'missing';
  text: string;
}

export interface AlignmentResult {
  alignmentScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: Suggestion[];
}