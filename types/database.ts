/**
 * Supabase Postgres 스키마 타입.
 *
 * bid_announcements 테이블만 사용. (Python collector 가 적재)
 *
 * 추후 변경 시 supabase CLI 의 `gen-types` 로 자동 생성 가능:
 *   supabase gen types typescript --project-id $PROJECT_ID --schema public
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface BidAnnouncement {
  id: number;
  source: string;
  bid_no: string;
  title: string;
  org_name: string | null;
  region: string | null;
  contract_method: string | null;
  estimated_price: number | null;
  open_date: string | null;
  close_date: string | null;
  bid_type: string | null;
  detail_url: string | null;
  created_at: string;
  is_notified: boolean;
}

export type BidAnnouncementInsert = Omit<BidAnnouncement, "id" | "created_at" | "is_notified"> & {
  id?: number;
  created_at?: string;
  is_notified?: boolean;
};

export type BidAnnouncementUpdate = Partial<BidAnnouncementInsert>;

export interface BidAssignee {
  id: number;
  bid_id: number;
  rep_name: string;
  note: string | null;
  assigned_at: string;
}
export type BidAssigneeInsert = Omit<BidAssignee, "id" | "assigned_at"> & {
  id?: number;
  assigned_at?: string;
};
export type BidAssigneeUpdate = Partial<BidAssigneeInsert>;

export type Database = {
  public: {
    Tables: {
      bid_announcements: {
        Row: BidAnnouncement;
        Insert: BidAnnouncementInsert;
        Update: BidAnnouncementUpdate;
        Relationships: [];
      };
      bid_assignees: {
        Row: BidAssignee;
        Insert: BidAssigneeInsert;
        Update: BidAssigneeUpdate;
        Relationships: [
          {
            foreignKeyName: "bid_assignees_bid_id_fkey";
            columns: ["bid_id"];
            referencedRelation: "bid_announcements";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      bid_source_counts: {
        Row: {
          source: string;
          total: number;
          today: number;
        };
        Relationships: [];
      };
    };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
