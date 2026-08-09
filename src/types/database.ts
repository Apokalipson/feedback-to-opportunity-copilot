export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          display_name?: string;
          updated_at?: string;
        }
      >;
      imports: Table<
        {
          id: string;
          owner_id: string;
          source_filename: string;
          status: Database["public"]["Enums"]["import_status"];
          is_current: boolean;
          total_rows: number;
          accepted_rows: number;
          rejected_rows: number;
          warning_rows: number;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          owner_id: string;
          source_filename: string;
          status?: Database["public"]["Enums"]["import_status"];
          is_current?: boolean;
          total_rows?: number;
          accepted_rows?: number;
          rejected_rows?: number;
          warning_rows?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          source_filename?: string;
          status?: Database["public"]["Enums"]["import_status"];
          is_current?: boolean;
          total_rows?: number;
          accepted_rows?: number;
          rejected_rows?: number;
          warning_rows?: number;
          updated_at?: string;
        }
      >;
      survey_responses: Table<
        {
          id: string;
          import_id: string;
          owner_id: string;
          source_row_number: number;
          raw_payload: Json;
          normalized_texts: Json;
          q2_feature_codes: number[];
          q3_feature_code: number | null;
          validation_status: Database["public"]["Enums"]["validation_status"];
          validation_issues: Json;
          created_at: string;
        },
        {
          id?: string;
          import_id: string;
          owner_id: string;
          source_row_number: number;
          raw_payload: Json;
          normalized_texts?: Json;
          q2_feature_codes?: number[];
          q3_feature_code?: number | null;
          validation_status?: Database["public"]["Enums"]["validation_status"];
          validation_issues?: Json;
          created_at?: string;
        },
        {
          raw_payload?: Json;
          normalized_texts?: Json;
          q2_feature_codes?: number[];
          q3_feature_code?: number | null;
          validation_status?: Database["public"]["Enums"]["validation_status"];
          validation_issues?: Json;
        }
      >;
      response_analyses: Table<
        {
          id: string;
          response_id: string;
          import_id: string;
          owner_id: string;
          topic: string | null;
          user_problem: string | null;
          sentiment: string | null;
          product_area: string | null;
          confidence: number | null;
          uncertainty_metadata: Json;
          model_identifier: string | null;
          analysis_version: string | null;
          created_at: string;
        },
        {
          id?: string;
          response_id: string;
          import_id: string;
          owner_id: string;
          topic?: string | null;
          user_problem?: string | null;
          sentiment?: string | null;
          product_area?: string | null;
          confidence?: number | null;
          uncertainty_metadata?: Json;
          model_identifier?: string | null;
          analysis_version?: string | null;
          created_at?: string;
        },
        {
          topic?: string | null;
          user_problem?: string | null;
          sentiment?: string | null;
          product_area?: string | null;
          confidence?: number | null;
          uncertainty_metadata?: Json;
          model_identifier?: string | null;
          analysis_version?: string | null;
        }
      >;
      feedback_groups: Table<
        {
          id: string;
          import_id: string;
          owner_id: string;
          label: string;
          summary: string | null;
          confidence: number | null;
          grouping_version: string | null;
          created_at: string;
        },
        {
          id?: string;
          import_id: string;
          owner_id: string;
          label: string;
          summary?: string | null;
          confidence?: number | null;
          grouping_version?: string | null;
          created_at?: string;
        },
        {
          label?: string;
          summary?: string | null;
          confidence?: number | null;
          grouping_version?: string | null;
        }
      >;
      group_memberships: Table<
        {
          group_id: string;
          response_id: string;
          import_id: string;
          owner_id: string;
          confidence: number | null;
          created_at: string;
        },
        {
          group_id: string;
          response_id: string;
          import_id: string;
          owner_id: string;
          confidence?: number | null;
          created_at?: string;
        },
        {
          confidence?: number | null;
        }
      >;
      opportunity_cards: Table<
        {
          id: string;
          group_id: string | null;
          import_id: string;
          owner_id: string;
          user_need: string;
          potential_solution: string | null;
          research_questions: string[];
          review_status: Database["public"]["Enums"]["review_status"];
          ai_generated: boolean;
          analysis_version: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          group_id?: string | null;
          import_id: string;
          owner_id: string;
          user_need: string;
          potential_solution?: string | null;
          research_questions?: string[];
          review_status?: Database["public"]["Enums"]["review_status"];
          ai_generated?: boolean;
          analysis_version?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          group_id?: string | null;
          user_need?: string;
          potential_solution?: string | null;
          research_questions?: string[];
          review_status?: Database["public"]["Enums"]["review_status"];
          ai_generated?: boolean;
          analysis_version?: string | null;
          updated_at?: string;
        }
      >;
      opportunity_evidence: Table<
        {
          card_id: string;
          response_id: string;
          import_id: string;
          owner_id: string;
          representative_quote: string;
          created_at: string;
        },
        {
          card_id: string;
          response_id: string;
          import_id: string;
          owner_id: string;
          representative_quote: string;
          created_at?: string;
        },
        {
          representative_quote?: string;
        }
      >;
      opportunity_review_history: Table<
        {
          id: string;
          card_id: string;
          import_id: string;
          owner_id: string;
          previous_status: Database["public"]["Enums"]["review_status"] | null;
          new_status: Database["public"]["Enums"]["review_status"];
          edited_fields: Json;
          review_note: string | null;
          created_at: string;
        },
        {
          id?: string;
          card_id: string;
          import_id: string;
          owner_id: string;
          previous_status?: Database["public"]["Enums"]["review_status"] | null;
          new_status: Database["public"]["Enums"]["review_status"];
          edited_fields?: Json;
          review_note?: string | null;
          created_at?: string;
        },
        Record<string, never>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      replace_current_import_analysis: {
        Args: {
          p_import_id: string;
          p_model_identifier: string;
          p_analysis_version: string;
          p_payload: Json;
        };
        Returns: Json;
      };
      review_current_opportunity_card: {
        Args: {
          p_import_id: string;
          p_card_id: string;
          p_expected_updated_at: string;
          p_user_need: string;
          p_potential_solution: string;
          p_research_questions: string[];
          p_review_status: Database["public"]["Enums"]["review_status"];
          p_review_note: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      import_status: "pending" | "validating" | "ready" | "failed";
      validation_status: "valid" | "warning" | "invalid";
      review_status: "pending" | "approved" | "rejected";
    };
    CompositeTypes: Record<string, never>;
  };
};
