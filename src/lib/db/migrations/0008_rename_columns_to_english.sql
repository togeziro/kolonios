-- Migration: Rename all Indonesian column names to English
-- Run this migration AFTER backing up your database

-- locations table
ALTER TABLE "locations" RENAME COLUMN "nama_lokasi" TO "location_name";
ALTER TABLE "locations" RENAME COLUMN "lat_kantor" TO "company_latitude";
ALTER TABLE "locations" RENAME COLUMN "long_kantor" TO "company_longitude";
ALTER TABLE "locations" RENAME COLUMN "keterangan" TO "description";

-- shifts table
ALTER TABLE "shifts" RENAME COLUMN "nama_shift" TO "shift_name";
ALTER TABLE "shifts" RENAME COLUMN "jam_masuk" TO "check_in_time";
ALTER TABLE "shifts" RENAME COLUMN "jam_keluar" TO "check_out_time";

-- employee_shifts table
ALTER TABLE "employee_shifts" RENAME COLUMN "tanggal" TO "date";
ALTER TABLE "employee_shifts" RENAME COLUMN "jam_absen" TO "check_in_time_actual";
ALTER TABLE "employee_shifts" RENAME COLUMN "telat" TO "minutes_late";
ALTER TABLE "employee_shifts" RENAME COLUMN "lat_absen" TO "check_in_latitude";
ALTER TABLE "employee_shifts" RENAME COLUMN "long_absen" TO "check_in_longitude";
ALTER TABLE "employee_shifts" RENAME COLUMN "jarak_masuk" TO "check_in_distance_meters";
ALTER TABLE "employee_shifts" RENAME COLUMN "foto_jam_absen" TO "check_in_photo_url";
ALTER TABLE "employee_shifts" RENAME COLUMN "keterangan_masuk" TO "check_in_note";
ALTER TABLE "employee_shifts" RENAME COLUMN "jam_pulang" TO "check_out_time_actual";
ALTER TABLE "employee_shifts" RENAME COLUMN "pulang_cepat" TO "minutes_early";
ALTER TABLE "employee_shifts" RENAME COLUMN "lat_pulang" TO "check_out_latitude";
ALTER TABLE "employee_shifts" RENAME COLUMN "long_pulang" TO "check_out_longitude";
ALTER TABLE "employee_shifts" RENAME COLUMN "jarak_pulang" TO "check_out_distance_meters";
ALTER TABLE "employee_shifts" RENAME COLUMN "foto_jam_pulang" TO "check_out_photo_url";
ALTER TABLE "employee_shifts" RENAME COLUMN "keterangan_pulang" TO "check_out_note";
ALTER TABLE "employee_shifts" RENAME COLUMN "status_absen" TO "attendance_status";
ALTER TABLE "employee_shifts" RENAME COLUMN "lock_location" TO "geo_fence_enabled";
ALTER TABLE "employee_shifts" RENAME COLUMN "jam_masuk_pengajuan" TO "approved_check_in_time";
ALTER TABLE "employee_shifts" RENAME COLUMN "jam_pulang_pengajuan" TO "approved_check_out_time";
ALTER TABLE "employee_shifts" RENAME COLUMN "deskripsi" TO "description";
ALTER TABLE "employee_shifts" RENAME COLUMN "status_pengajuan" TO "approval_status";
ALTER TABLE "employee_shifts" RENAME COLUMN "file_pengajuan" TO "supporting_document_url";
ALTER TABLE "employee_shifts" RENAME COLUMN "komentar" TO "comments";
ALTER TABLE "employee_shifts" RENAME COLUMN "approved_by" TO "approved_by";

-- leaves table
ALTER TABLE "leaves" RENAME COLUMN "tanggal_mulai" TO "start_date";
ALTER TABLE "leaves" RENAME COLUMN "tanggal_akhir" TO "end_date";
ALTER TABLE "leaves" RENAME COLUMN "jumlah_hari" TO "total_days";
ALTER TABLE "leaves" RENAME COLUMN "jenis_cuti" TO "leave_type";
ALTER TABLE "leaves" RENAME COLUMN "disetujui_oleh" TO "approved_by";
ALTER TABLE "leaves" RENAME COLUMN "tanggal_disetujui" TO "approved_at";

-- employees table
ALTER TABLE "employees" RENAME COLUMN "nama_lengkap" TO "full_name";
ALTER TABLE "employees" RENAME COLUMN "nama_panggilan" TO "nickname";
ALTER TABLE "employees" RENAME COLUMN "telepon" TO "phone";
ALTER TABLE "employees" RENAME COLUMN "tempat_lahir" TO "birth_place";
ALTER TABLE "employees" RENAME COLUMN "tanggal_lahir" TO "birth_date";
ALTER TABLE "employees" RENAME COLUMN "no_ktp" TO "id_number";
ALTER TABLE "employees" RENAME COLUMN "magang" TO "is_internship";
ALTER TABLE "employees" RENAME COLUMN "status_kerja" TO "employment_status";
ALTER TABLE "employees" RENAME COLUMN "tanggal_masuk" TO "join_date";
ALTER TABLE "employees" RENAME COLUMN "tanggal_keluar" TO "leave_date";
ALTER TABLE "employees" RENAME COLUMN "gaji_pokok" TO "base_salary";