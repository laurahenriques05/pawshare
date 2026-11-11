export type Vaccination = { id:string; household_id:string; name:string; given_on:string; next_due_on:string|null; veterinarian:string; batch_number:string; notes:string; created_by:string; updated_by:string; created_at:string; updated_at:string }
export type MedicationSchedule = { id:string; household_id:string; name:string; instructions:string; created_by:string; updated_by:string; created_at:string; updated_at:string }
export type MedicationDose = { id:string; schedule_id:string; scheduled_at:string; status:'scheduled'|'given'|'skipped'; administered_at:string|null; recorded_by:string|null; recorded_at:string|null; updated_at:string; notes:string }
export type VetAppointment = { id: string; household_id: string; title: string; starts_at: string; location: string; notes: string; created_by: string; updated_by: string; created_at: string; updated_at: string }
import type { FoodProduct, FeedingEntry, FeedingSettings, FeedingAudit, PlannedMeal, MealEvent } from '../../features/feeding/types'
// Initial migration contract. Regenerate with the Supabase CLI after schema changes.
export type Profile = { id: string; display_name: string; created_at: string }
export type Household = { id: string; name: string; timezone: string; created_by: string; created_at: string }
export type Member = { household_id: string; user_id: string; role: 'owner' | 'member'; created_at: string }
export type Dog = { id: string; household_id: string; name: string; breed: string | null; date_of_birth: string | null; weight_kg: number | null; sex: 'male' | 'female' | 'unknown'; neutered: boolean | null; activity_level: 'low' | 'moderate' | 'high'; created_at: string }
export type Invitation = { id: string; household_id: string; email: string; created_by: string; created_at: string; expires_at: string; accepted_at: string | null; accepted_by: string | null; revoked_at: string | null }
export type InvitationPreview = { household_id: string; household_name: string; dog_name: string | null; expires_at: string; already_member: boolean }
export type FamilyMember = { user_id: string; display_name: string; role: string; joined_at: string }
export type Walk = { id: string; household_id: string; dog_id: string; walker_id: string; started_at: string; ended_at: string | null; distance_m: number; notes: string; end_reason: 'manual' | 'stationary' | null; deleted_at: string | null }
export type WalkPoint = { walk_id: string; seq: number; recorded_at: string; latitude: number; longitude: number; accuracy: number }
type Table<R, I> = { Row: R; Insert: I; Update: Partial<I>; Relationships: [] }
export type Database = { public: { Tables: {
 vaccinations: Table<Vaccination,Pick<Vaccination,'household_id'|'name'|'given_on'|'next_due_on'|'veterinarian'|'batch_number'|'notes'>>;
 medication_schedules: Table<MedicationSchedule,never>;
 medication_doses: Table<MedicationDose,never>;
 vet_appointments: Table<VetAppointment, Pick<VetAppointment,'household_id'|'title'|'starts_at'|'location'|'notes'>>;
 feeding_meal_events: Table<MealEvent, never>;
 food_products: Table<FoodProduct, never>;
 feeding_entries: Table<FeedingEntry, never>;
 feeding_settings: Table<FeedingSettings, never>;
 feeding_audit: Table<FeedingAudit, never>;
 walks: Table<Walk, never>;
 walk_points: Table<WalkPoint, never>;
 profiles: Table<Profile, Pick<Profile,'id'|'display_name'>>;
 households: Table<Household, Pick<Household,'name'|'timezone'|'created_by'>>;
 household_members: Table<Member, Pick<Member,'household_id'|'user_id'|'role'>>;
 invitations: Table<Invitation & { token_hash: string }, never>;
 dogs: Table<Dog, Omit<Dog,'id'|'created_at'>>;
}; Views: { [_ in never]: never }; Functions: {
 save_medication_schedule: { Args:{p_household:string;p_schedule:string|null;p_name:string;p_instructions:string;p_times:string[]}; Returns:string };
 reschedule_medication_dose: { Args:{p_dose:string;p_time:string}; Returns:undefined };
 log_medication_dose: { Args:{p_dose:string;p_status:string;p_actual:string|null;p_notes:string}; Returns:undefined };
 save_meal_result: {Args:{p_household:string;p_id:string;p_items:{product_id:string;quantity_grams:number;eaten_grams:number}[];p_at:string;p_source?:string;p_allow_duplicate?:boolean;p_routine_meal?:string|null;p_outcome?:string;p_notes?:string;p_remove?:boolean};Returns:string};
 save_feeding_plan: { Args: { p_household:string; p_plan:PlannedMeal[]; p_warning:number|null }; Returns:undefined };
 record_feeding_meal: { Args:{p_household:string;p_id:string;p_items:{product_id:string;quantity_grams:number}[];p_at:string;p_source:string;p_allow_duplicate:boolean;p_routine_meal:string|null}; Returns:string };
 save_food_product: { Args: { p_household: string; p_id: string; p_name: string; p_category: string; p_portion: number; p_daily: number; p_opening: number; p_reminder: number }; Returns: string };
 save_feeding_settings: { Args: { p_household: string; p_meals: number }; Returns: undefined };
 save_feeding_entry: { Args: { p_household: string; p_id: string; p_product: string; p_kind: string; p_quantity: number; p_at: string; p_package?: number | null; p_packages?: number | null; p_source?: string; p_allow_duplicate?: boolean; p_delete?: boolean }; Returns: string };
 start_walk: { Args: { p_dog: string }; Returns: Walk };
 append_walk_points: { Args: { p_walk: string; p_points: { seq: number; recorded_at: string; latitude: number; longitude: number; accuracy: number }[] }; Returns: number };
 finish_walk: { Args: { p_walk: string; p_ended_at: string; p_reason: string }; Returns: Walk };
 correct_walk: { Args: { p_walk: string; p_started_at: string; p_ended_at: string; p_notes: string }; Returns: Walk };
 set_walk_deleted: { Args: { p_walk: string; p_deleted: boolean }; Returns: undefined };
 leave_household: { Args: { p_household: string; p_new_owner?: string | null }; Returns: undefined };
 create_household_invitation: { Args: { p_household: string; p_email: string }; Returns: { id: string; token: string; expires_at: string } };
 preview_household_invitation: { Args: { p_token: string }; Returns: InvitationPreview };
 accept_household_invitation: { Args: { p_token: string }; Returns: string };
 revoke_household_invitation: { Args: { p_invitation: string }; Returns: undefined };
 get_household_members: { Args: { p_household: string }; Returns: FamilyMember[] };
 create_household: { Args: { p_name: string; p_timezone: string }; Returns: string };
}; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } }
