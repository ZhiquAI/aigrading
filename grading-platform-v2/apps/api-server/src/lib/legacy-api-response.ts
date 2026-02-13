import { NextResponse } from "next/server";

type LegacySuccessPayload<T> = {
  success: true;
  message: string;
  data: T;
};

type LegacyErrorPayload = {
  success: false;
  message: string;
  data: null;
};

export const legacySuccess = <T>(data: T, message = "Success", status = 200): NextResponse => {
  const payload: LegacySuccessPayload<T> = {
    success: true,
    message,
    data
  };

  return NextResponse.json(payload, { status });
};

export const legacyError = (message: string, status = 400): NextResponse => {
  const payload: LegacyErrorPayload = {
    success: false,
    message,
    data: null
  };

  return NextResponse.json(payload, { status });
};
