// Role hierarchy: viewer < writer < admin < owner
export type Role = 'viewer' | 'writer' | 'admin' | 'owner';

export interface RoomRole {
  id: string
  room_id: string
  user_id: string
  role: Role
  assigned_by: string | null
  created_at: string
  updated_at: string
}

const roleHierarchy: Record<Role, number> = {
  viewer: 1,
  writer: 2,
  admin: 3,
  owner: 4,
};

/**
 * Compare two roles - returns true if role1 >= role2
 */
export function hasRoleOrHigher(role1: Role | null, role2: Role): boolean {
  if (!role1) return false;
  return roleHierarchy[role1] >= roleHierarchy[role2];
}

/**
 * Check if user can perform action based on their role
 */
export function canPerformAction(userRole: Role | null, requiredRole: Role): boolean {
  return hasRoleOrHigher(userRole, requiredRole);
}

/**
 * Check if user can assign a specific role
 */
export function canAssignRole(assignerRole: Role | null, targetRole: Role): boolean {
  if (!assignerRole) return false;
  
  // Owner can assign any role
  if (assignerRole === 'owner') return true;
  
  // Admin can assign viewer, writer, admin (but not owner)
  if (assignerRole === 'admin') {
    return targetRole !== 'owner';
  }
  
  return false;
}

/**
 * Get user role in room
 */
export async function getUserRoleInRoom(roomId: string, userId: string, supabase: any): Promise<Role | null> {
  try {
    // First check explicit role
    const { data: roleData, error: roleError } = await supabase
      .from('room_roles')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (roleData && !roleError) {
      return roleData.role as Role;
    }

    // Fallback: check if user is room creator (legacy support)
    const { data: roomData } = await supabase
      .from('rooms')
      .select('created_by')
      .eq('id', roomId)
      .single();

    if (roomData?.created_by === userId) {
      return 'owner';
    }

    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Permission checks for different actions
 */
export const permissions = {
  canViewMessages: (role: Role | null) => canPerformAction(role, 'viewer'),
  canSendMessages: (role: Role | null) => canPerformAction(role, 'writer'),
  canDeleteMessages: (role: Role | null) => canPerformAction(role, 'writer'),
  canEditPrompt: (role: Role | null) => canPerformAction(role, 'admin'),
  canRenameRoom: (role: Role | null) => canPerformAction(role, 'admin'),
  canDeleteRoom: (role: Role | null) => canPerformAction(role, 'owner'),
  canManageRoles: (role: Role | null) => canPerformAction(role, 'admin'),
};

