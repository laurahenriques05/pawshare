export type HealthAudit = { id:string;household_id:string;created_by:string|null;updated_by:string|null;created_at:string;updated_at:string }
export type Treatment = HealthAudit & {title:string;occurred_on:string;veterinarian:string;notes:string}
export type VetContact = HealthAudit & {name:string;phone:string;email:string;address:string;notes:string}
export type WeightMeasurement = HealthAudit & {weight_kg:number;measured_at:string;notes:string}
export type Vaccination = { id:string; household_id:string; name:string; given_on:string; next_due_on:string|null; veterinarian:string; batch_number:string; notes:string; created_by:string|null; updated_by:string|null; created_at:string; updated_at:string }
export type MedicationSchedule = { id:string; household_id:string; name:string; instructions:string; created_by:string|null; updated_by:string|null; created_at:string; updated_at:string }
export type MedicationDose = { id:string; schedule_id:string; scheduled_at:string; status:'scheduled'|'given'|'skipped'; administered_at:string|null; recorded_by:string|null; recorded_at:string|null; updated_at:string; notes:string }
export type VetAppointment = { id: string; household_id: string; title: string; starts_at: string; location: string; notes: string; created_by: string|null; updated_by: string|null; created_at: string; updated_at: string }
export type TaskSeries = { id:string;household_id:string;title:string;details:string;assigned_to:string|null;first_due_at:string;recurrence:'none'|'daily'|'weekly'|'monthly';recurrence_every:number;ends_on:string|null;archived_at:string|null;created_by:string|null;updated_by:string|null;created_at:string;updated_at:string }
export type TaskOccurrence = { id:string;household_id:string;series_id:string;title:string;details:string;assigned_to:string|null;recurrence:'none'|'daily'|'weekly'|'monthly';recurrence_every:number;due_at:string;completed_at:string|null;completed_by:string|null;created_at:string }
export type AcademyPractice = { id:string;household_id:string;dog_id:string;module_id:string;user_id:string|null;practiced_at:string;checklist:Record<string,boolean>;performance:string;completed:boolean;deleted_at:string|null;updated_at:string }
export type AcademyModuleProgress = { household_id:string;dog_id:string;module_id:string;completed_at:string;completed_by:string|null }
export type AcademyModuleRow = { id:string;course_id:string;position:number }
export type PushSubscription = { id:string;user_id:string;endpoint:string;p256dh:string;auth:string;created_at:string;updated_at:string }
export type NotificationPreference = { user_id:string;category:'task'|'feeding'|'health'|'walk'|'academy';enabled:boolean;updated_at:string }
export type ScheduledNotification = { id:string;household_id:string;recipient_id:string;category:NotificationPreference['category'];source_id:string;delivery_kind:'reminder'|'overdue_escalation';title:string;body:string;route:string;send_at:string;status:'pending'|'sending'|'sent'|'failed'|'cancelled';attempts:number;claimed_at:string|null;sent_at:string|null;last_error:string;created_at:string }
import type { FoodProduct, FeedingEntry, FeedingSettings, FeedingAudit, PlannedMeal, MealEvent } from '../../features/feeding/types'
// Initial migration contract. Regenerate with the Supabase CLI after schema changes.
export type Profile = { id: string; display_name: string; created_at: string }
export type Household = { id: string; name: string; timezone: string; created_by: string|null; created_at: string }
export type Member = { household_id: string; user_id: string; role: 'owner' | 'member'; created_at: string }
export type Dog = { id: string; household_id: string; name: string; breed: string | null; date_of_birth: string | null; weight_kg: number | null; sex: 'male' | 'female' | 'unknown'; neutered: boolean | null; activity_level: 'low' | 'moderate' | 'high'; created_at: string }
export type Invitation = { id: string; household_id: string; email: string; created_by: string|null; created_at: string; expires_at: string; accepted_at: string | null; accepted_by: string | null; revoked_at: string | null }
export type InvitationPreview = { household_id: string; household_name: string; dog_name: string | null; expires_at: string; already_member: boolean }
export type FamilyMember = { user_id: string; display_name: string; role: string; joined_at: string }
export type Walk = { id: string; household_id: string; dog_id: string; walker_id: string|null; started_at: string; ended_at: string | null; distance_m: number; notes: string; end_reason: 'manual' | 'stationary' | null; deleted_at: string | null }
export type WalkPoint = { walk_id: string; seq: number; recorded_at: string; latitude: number; longitude: number; accuracy: number }
type Table<R, I> = { Row: R; Insert: I; Update: Partial<I>; Relationships: [] }
export type Database = { public: { Tables: {
 treatments: Table<Treatment,Pick<Treatment,'household_id'|'title'|'occurred_on'|'veterinarian'|'notes'>>;
 vet_contacts: Table<VetContact,Pick<VetContact,'household_id'|'name'|'phone'|'email'|'address'|'notes'>>;
 weight_measurements: Table<WeightMeasurement,Pick<WeightMeasurement,'household_id'|'weight_kg'|'measured_at'|'notes'>>;
 vaccinations: Table<Vaccination,Pick<Vaccination,'household_id'|'name'|'given_on'|'next_due_on'|'veterinarian'|'batch_number'|'notes'>>;
 medication_schedules: Table<MedicationSchedule,never>;
 medication_doses: Table<MedicationDose,never>;
 vet_appointments: Table<VetAppointment, Pick<VetAppointment,'household_id'|'title'|'starts_at'|'location'|'notes'>>;
 task_series: Table<TaskSeries, Pick<TaskSeries,'household_id'|'title'|'details'|'assigned_to'|'first_due_at'|'recurrence'|'recurrence_every'|'ends_on'>>;
 task_occurrences: Table<TaskOccurrence, never>;
 academy_practice: Table<AcademyPractice, Pick<AcademyPractice,'household_id'|'dog_id'|'module_id'|'checklist'|'performance'|'completed'>>;
 academy_module_progress: Table<AcademyModuleProgress, never>;
 academy_modules: Table<AcademyModuleRow, never>;
 push_subscriptions: Table<PushSubscription, Pick<PushSubscription,'user_id'|'endpoint'|'p256dh'|'auth'>>;
 notification_preferences: Table<NotificationPreference, Pick<NotificationPreference,'user_id'|'category'|'enabled'>>;
 scheduled_notifications: Table<ScheduledNotification, never>;
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
 save_household_task: { Args:{p_household:string;p_id:string|null;p_title:string;p_details:string;p_assigned_to:string|null;p_first_due_at:string;p_recurrence:string;p_recurrence_every:number;p_ends_on:string|null}; Returns:string };
 generate_task_occurrences: { Args:{p_household:string;p_from:string;p_until:string}; Returns:number };
 complete_household_task: { Args:{p_occurrence:string;p_completed:boolean}; Returns:undefined };
 archive_household_task: { Args:{p_household:string;p_task:string}; Returns:undefined };
 save_academy_practice: { Args:{p_household:string;p_id:string|null;p_dog:string;p_module:string;p_checklist:Record<string,boolean>;p_performance:string;p_completed:boolean;p_delete?:boolean}; Returns:string };
 claim_due_notifications: { Args:{p_limit?:number}; Returns:ScheduledNotification[] };
 finish_notification_delivery: { Args:{p_id:string;p_outcome:string;p_error?:string}; Returns:undefined };
 sync_household_notification: { Args:{p_household:string;p_recipient:string|null;p_category:'feeding'|'health'|'walk'|'academy';p_source_id:string;p_delivery_kind:'reminder'|'overdue_escalation';p_title:string;p_body:string;p_route:string;p_send_at:string}; Returns:number };
 cancel_household_notifications: { Args:{p_household:string;p_category:'feeding'|'health'|'walk'|'academy';p_source_id:string}; Returns:number };
 create_household: { Args: { p_name: string; p_timezone: string }; Returns: string };
}; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } }
