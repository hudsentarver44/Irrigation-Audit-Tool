// db.js
// Thin Firestore CRUD wrapper. Two top-level collections: properties, audits.

import { db } from "./firebase-init.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const propertiesCol = () => collection(db, "properties");
const auditsCol = () => collection(db, "audits");

export async function listProperties() {
  const snap = await getDocs(query(propertiesCol(), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getProperty(id) {
  const snap = await getDoc(doc(db, "properties", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createProperty(data) {
  const ref = await addDoc(propertiesCol(), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProperty(id, data) {
  await updateDoc(doc(db, "properties", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProperty(id) {
  await deleteDoc(doc(db, "properties", id));
}

export async function listAuditsForProperty(propertyId) {
  const snap = await getDocs(
    query(auditsCol(), orderBy("date", "desc"))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => a.propertyId === propertyId);
}

export async function getAudit(id) {
  const snap = await getDoc(doc(db, "audits", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createAudit(data) {
  const ref = await addDoc(auditsCol(), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveAudit(id, data) {
  await setDoc(
    doc(db, "audits", id),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function deleteAudit(id) {
  await deleteDoc(doc(db, "audits", id));
}
