// Centralizes the server error-code → i18n-key mapping shared by the admin
// attendance card and the technician check-in flow.
export const CHECKIN_ERROR_I18N_KEYS: Record<string, string> = {
  GPS_REQUIRED: 'attendanceAdmin.errGpsRequired',
  GPS_STALE: 'attendanceAdmin.errGpsStale',
  GPS_INACCURATE: 'attendanceAdmin.errGpsInaccurate',
  OUTSIDE_RADIUS: 'attendanceAdmin.errOutsideRadius',
  NO_SCHEDULE: 'attendanceAdmin.errNoSchedule',
  SELFIE_REQUIRED: 'attendanceAdmin.errSelfieRequired',
  NO_CHECK_IN: 'attendanceAdmin.errNoCheckIn',
  ALREADY_CHECKED_OUT: 'attendanceAdmin.errAlreadyCheckedOut'
};
