export interface ParsedCompany {
  companyName: string;
  dbaName: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  usdotNumber: string;
  documentNumber: string;
  documentType: string;
  serviceDate: string;
  pdfFilename: string;
}

export interface SearchParams {
  type: "dot" | "mc" | "name";
  query: string;
}
