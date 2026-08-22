export function attendanceSelfieKey(userId: string, timestamp: number): string {
  return `attendance/${userId}/${timestamp}.jpg`;
}

export function customerIdCardKey(customerId: string): string {
  return `customers/${customerId}/id-card.jpg`;
}

export function ticketPhotoKey(ticketId: number, photoId: number): string {
  return `tickets/${ticketId}/${photoId}.jpg`;
}

export function checklistPhotoKey(userId: string, itemId: number, timestamp: number): string {
  return `checklists/${userId}/${itemId}-${timestamp}.jpg`;
}
