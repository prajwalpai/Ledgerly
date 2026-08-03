import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { assertLocalRequest, safeApiError } from "@/lib/security";
export const runtime="nodejs";
export async function POST(request:NextRequest){try{assertLocalRequest(request);const {patternKey}=await request.json();if(typeof patternKey!=="string"||!/^[a-f0-9]{64}$/.test(patternKey))return NextResponse.json({error:"Invalid pattern."},{status:400});getDatabase().prepare("INSERT OR IGNORE INTO dismissed_patterns (patternKey,createdAt) VALUES (?,?)").run(patternKey,new Date().toISOString());return NextResponse.json({ignored:true});}catch(error){const r=safeApiError(error);return NextResponse.json({error:r.message},{status:r.status});}}
export async function DELETE(request:NextRequest){try{assertLocalRequest(request);getDatabase().prepare("DELETE FROM dismissed_patterns").run();return NextResponse.json({restored:true});}catch(error){const r=safeApiError(error);return NextResponse.json({error:r.message},{status:r.status});}}
