# Fake News Detector

This is an advanced fake news detection tool that uses multiple AI providers to analyze news articles for authenticity, bias, and manipulation. It's designed to provide users with a detailed, multi-faceted analysis to help them make informed decisions about the content they consume.

The project includes a web application for direct text analysis and a browser extension for analyzing articles directly on any webpage.

## Features

- **Multi-Provider AI Analysis**: Leverages several leading AI models (OpenAI, Google Gemini, Groq, Deepseek, xAI) to analyze content, with failover and load balancing using multiple API keys.
- **Comprehensive Analysis Dashboard**: The analysis goes beyond a simple "fake" or "real" score. The results dashboard includes:
  - **Overall Verdict**: A clear, color-coded verdict (`TRUSTWORTHY`, `QUESTIONABLE`, `FAKE`).
  - **Authenticity & Confidence Scores**: A 0-100 score for the article's likely authenticity and the AI's confidence in its own assessment.
  - **Source Credibility**: An estimated credibility score for the news source itself.
  - **Bias Detection**: Identifies political and ideological biases in the text.
  - **Sentiment Analysis**: Determines the overall sentiment (Positive, Negative, Neutral) of the article.
  - **Claim Verification**: Extracts and individually analyzes major claims from the article.
  - **AI-Generated Content (AIGC) Score**: Estimates the likelihood that the article was written by an AI.
  - **Fact-Checker Cross-Referencing**: Provides direct links to reputable fact-checking organizations to cross-reference the story.
- **Browser Extension**: Analyze news articles on any site with a single click.
- **Educational Resources**: A dedicated `/learn` page teaches users how to spot the signs of misinformation themselves, empowering them to become more critical consumers of news.
- **Professional UI/UX**: Built with Next.js, TypeScript, and shadcn/ui for a clean, responsive, and user-friendly experience with both light and dark modes.

## Tech Stack

- **Framework**: Next.js
- **Language**: TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **AI SDKs**: OpenAI, Google Generative AI, Groq

## Getting Started

### Prerequisites

- Node.js (v18.x or later)
- pnpm (or npm/yarn)
- An API key from at least one of the supported AI providers.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/fake-news-detector.git
    cd fake-news-detector
    ```
2.  **Install dependencies:**
    ```bash
    pnpm install
    ```
3.  **Set up environment variables:**
    Create a `.env.local` file in the root of the project and add your API keys. You can add multiple keys for each provider, and the application will randomly select one for each request.

    ```env
    # Example for OpenAI
    OPENAI_API_KEY="your_openai_key"
    # Or use multiple keys
    OPENAI_API_KEY_1="your_first_key"
    OPENAI_API_KEY_2="your_second_key"

    # Example for Google Gemini
    GEMINI_API_KEY="your_gemini_key"

    # Example for Groq
    GROQ_API_KEY="your_groq_key"
    
    # ... and so on for DEEPSEEK and XAI
    ```

### Running the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Browser Extension

To use the browser extension:
1. Open your browser's extension management page (e.g., `chrome://extensions`).
2. Enable "Developer mode".
3. Click "Load unpacked" and select the `fake-news-detector` project directory.
4. The extension will be installed and ready to use.

## Future Scope

- **Multi-Modal Analysis**: Extend analysis to images, videos, and audio to detect deepfakes and out-of-context media.
- **User Feedback System**: Allow users to report inaccuracies and provide feedback to improve the models.
- **Historical Source Accuracy**: Track the accuracy of news sources over time to provide more dynamic credibility scores.

This project is a powerful tool in the fight against misinformation, designed with transparency and user empowerment at its core.
# guardian
