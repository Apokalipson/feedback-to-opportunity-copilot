# Product brief

## Product

**Name:** Feedback-to-Opportunity Copilot MVP

**Interface and generated content language:** English

**Primary user:** one privately authenticated Product Manager.

## Problem

Survey responses are difficult to review consistently and turn into actionable
product opportunities. The application should accelerate the first analysis
without transferring product decisions to AI.

## Core workflow

1. The Product Manager uploads a CSV survey export.
2. That file becomes the current import and the scope for counts and analysis.
3. The system validates and normalizes its rows.
4. AI proposes a topic, user problem, sentiment, and potential product area.
5. Similar statements are grouped within the current import.
6. AI drafts Opportunity Cards covering feedback about the complete ecosystem,
   not only features inside the mobile app.
7. The Product Manager searches and filters the results.
8. The Product Manager approves, edits, or rejects each card.

## Opportunity Card contract

Every draft card contains:

- user need;
- representative quotes linked to source responses;
- scale within the current import, shown as a count and percentage;
- potential solution;
- questions requiring further research;
- review status: `pending`, `approved`, or `rejected`;
- a visible indication that the content was AI-generated and awaits human review.

## MVP boundaries

Included:

- CSV upload;
- one current import at a time in the main workflow;
- private login for one Product Manager;
- relational persistence;
- server-side OpenAI integration with a usage limit;
- search, filtering, summaries, grouping, and human review;
- production deployment.

Not included:

- automatic call-center, email, social media, CRM, or analytics integrations;
- multiple organizations, teams, or permission levels;
- autonomous product decisions;
- use of real personal data during development, testing, or demonstrations;
- cross-import trend analysis in the MVP.

## Product principles

- AI proposes; the Product Manager decides.
- Source feedback remains traceable from every generated card.
- Invalid or uncertain model output fails safely and can be retried.
- The user can understand the scope behind every displayed count.
