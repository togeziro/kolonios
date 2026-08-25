// TODO(wire): No client-reachable server function returns the signed-in
// user's employee record yet (employees API only exposes list/detail by id,
// gated to admins). Render Work Information from this fixture, shaped like
// the future API DTO, until a self-profile endpoint exists.
export interface MyWorkInfo {
  employeeCode: string;
  department: string;
  jobTitle: string;
}

export const myWorkInfoFixture: MyWorkInfo = {
  employeeCode: 'TECH-0042',
  department: 'Field Operations',
  jobTitle: 'Senior Technician'
};
