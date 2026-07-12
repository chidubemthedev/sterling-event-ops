"use client";

import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, runTransaction, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  QrCode, 
  RefreshCw, 
  Box, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle,
  FileText,
  Activity,
  UserCheck,
  Undo2,
  Lock,
  Upload,
  Layers,
  Sparkles,
  Search,
  PackageCheck,
  FileImage,
  AlertCircle,
  ArrowRight,
  X,
  TrendingDown,
  FileSignature,
  DollarSign
} from "lucide-react";

interface EventItem {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  status: "active" | "archived";
  closeoutNotes?: string;
  itemsAllocated: Record<string, { 
    qtyCheckedOut: number; 
    qtyReturned: number;
    qtyDamaged?: number;
    qtyMissing?: number;
  }>;
  workspaceId: string;
  createdAt: string;
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unitOfMeasure: string;
  replacementValue: number;
  warehouseQty: number;
  deployedQty: number;
  quarantineQty: number;
  totalQty: number;
}

interface MovementLog {
  id: string;
  actionType: "CHECKOUT" | "RETURN" | "AUDIT_CORRECTION";
  workspaceId: string;
  eventId: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  quantity: number;
  snapshotUrl?: string;
  note?: string;
  actionedBy: string;
  actionedByName: string;
  createdAt: string;
}

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default function EventControlPage({ params }: PageProps) {
  const { eventId } = React.use(params);
  const router = useRouter();
  const { workspaceId, user, loading: authLoading } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<"checkout" | "return">("checkout");

  // Real-time states
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<MovementLog[]>([]);
  const [userRole, setUserRole] = useState<string>("staff");
  const [loading, setLoading] = useState(true);

  // --- CAMERA SCANNER DIALOG STATES ---
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTargetTab, setScannerTargetTab] = useState<"checkout" | "return">("checkout");
  const [isSecureContext, setIsSecureContext] = useState(true);
  const [cameraErrorMsg, setCameraErrorMsg] = useState("");
  const [activeCameraStream, setActiveCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- ZOOM IMAGE VIEW DIALOG STATES ---
  const [activeZoomUrl, setActiveZoomUrl] = useState<string | null>(null);

  // --- TAB A: CHECKOUT STATES ---
  const [scanSkuInput, setScanSkuInput] = useState("");
  const [matchedItem, setMatchedItem] = useState<InventoryItem | null>(null);
  const [checkoutQty, setCheckoutQty] = useState("");
  const [checkoutSnapshot, setCheckoutSnapshot] = useState<File | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // --- TAB B: RETURN STATES ---
  const [activeReturnItem, setActiveReturnItem] = useState<InventoryItem | null>(null);
  const [returnQty, setReturnQty] = useState("");
  const [returnCondition, setReturnCondition] = useState<"Excellent" | "Good" | "Fair" | "Damaged">("Excellent");
  const [returnNote, setReturnNote] = useState("");
  const [returnPhoto, setReturnPhoto] = useState<File | null>(null);
  const [returnError, setReturnError] = useState("");
  const [returnSuccess, setReturnSuccess] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  
  // Return scanner simulation
  const [scanReturnSkuInput, setScanReturnSkuInput] = useState("");
  const [returnMismatchedAlert, setReturnMismatchedAlert] = useState("");

  // Reversal execution states
  const [reversingId, setReversingId] = useState<string | null>(null);

  // Close Out Event states
  const [isCloseoutOpen, setIsCloseoutOpen] = useState(false);
  const [closeoutNotesInput, setCloseoutNotesInput] = useState("");
  const [submittingCloseout, setSubmittingCloseout] = useState(false);
  const [closeoutError, setCloseoutError] = useState("");

  // Operator credentials
  const actionedByName = user?.displayName || user?.email?.split("@")[0] || "Operator Staff";
  const actionedByUid = user?.uid || "unknown";

  // Check if current user is admin/superadmin
  useEffect(() => {
    if (!user) return;
    
    // Auto-grant admin for specific developer test emails or user profiles
    if (user.email === "chukwudubem7@gmail.com") {
      setUserRole("superadmin");
      return;
    }

    const fetchRole = async () => {
      try {
        const uDoc = await doc(db, "users", user.uid);
        onSnapshot(uDoc, (snapshot) => {
          if (snapshot.exists()) {
            setUserRole(snapshot.data().role || "staff");
          }
        });
      } catch (err) {
        console.error("Error reading user profile role:", err);
      }
    };
    fetchRole();
  }, [user]);

  // Real-time synchronization
  useEffect(() => {
    if (authLoading || !workspaceId || !eventId) return;

    setLoading(true);

    // 1. Subscribe to specific event document
    const eventRef = doc(db, "events", eventId);
    const unsubscribeEvent = onSnapshot(eventRef, (snap) => {
      if (snap.exists()) {
        setEventData({ id: snap.id, ...snap.data() } as EventItem);
      } else {
        setEventData(null);
      }
    }, (err) => console.error("Event document sub error:", err));

    // 2. Subscribe to inventory of this workspace
    const qInv = query(collection(db, "inventory"), where("workspaceId", "==", workspaceId));
    const unsubscribeInv = onSnapshot(qInv, (snap) => {
      const list: InventoryItem[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as InventoryItem);
      });
      setInventoryList(list);
    }, (err) => console.error("Inventory sub error:", err));

    // 3. Subscribe to movement logs of this event
    const qLogs = query(collection(db, "movement_logs"), where("eventId", "==", eventId));
    const unsubscribeLogs = onSnapshot(qLogs, (snap) => {
      const list: MovementLog[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as MovementLog);
      });
      // Sort client-side by log date descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActivityLogs(list);
      setLoading(false);
    }, (err) => {
      console.error("Movement logs sub error:", err);
      setLoading(false);
    });

    return () => {
      unsubscribeEvent();
      unsubscribeInv();
      unsubscribeLogs();
    };
  }, [workspaceId, eventId, authLoading]);

  // Secure Context & DOM Mount Checks + Track Cleanups useEffect Hook
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("Is Secure Context:", window.isSecureContext);
      setIsSecureContext(window.isSecureContext);
    }
  }, []);

  useEffect(() => {
    if (!isScannerOpen) {
      // 3. Stream Cleanup Routine on close
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log("Explicit Cleanup: Stopped video track:", track.label);
        });
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setActiveCameraStream(null);
      return;
    }

    let activeStream: MediaStream | null = null;

    // 1. DOM Mount Check: Delay starting getUserMedia to guarantee video tag has fully mounted in modal DOM
    const startStream = async () => {
      setCameraErrorMsg("");
      try {
        // Secure context check
        if (typeof window !== "undefined" && !window.isSecureContext) {
          console.warn("Camera stream initialization blocked: Non-secure Context.");
          return;
        }

        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
          });
          activeStream = stream;
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          } else {
            console.warn("Video ref is currently unassigned in active layout.");
          }
          // Clear error/loading on success and save stream in state to trigger re-renders
          setCameraErrorMsg("");
          setActiveCameraStream(stream);
        } else {
          setCameraErrorMsg("The browser does not support MediaDevices hardware streaming.");
        }
      } catch (err: any) {
        console.error("Webcam device enumeration failed:", err);
        setCameraErrorMsg(err.message || "Could not start camera stream.");
        setActiveCameraStream(null);
      }
    };

    const mountTimer = setTimeout(() => {
      startStream();
    }, 150);

    return () => {
      clearTimeout(mountTimer);
      if (activeStream) {
        activeStream.getTracks().forEach((track) => {
          track.stop();
          console.log("Cleanup unmount: Stopped track:", track.label);
        });
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setActiveCameraStream(null);
    };
  }, [isScannerOpen]);

  const startCameraStream = (target: "checkout" | "return") => {
    setScannerTargetTab(target);
    setIsScannerOpen(true);
    setReturnMismatchedAlert("");
    setCheckoutError("");
  };

  const stopCameraStream = () => {
    setIsScannerOpen(false);
  };

  // Simulating barcode scanner click selection inside Dialog overlay
  const handleSimulateScan = (item: InventoryItem) => {
    stopCameraStream();

    if (scannerTargetTab === "checkout") {
      setMatchedItem(item);
      setCheckoutQty("1");
      setScanSkuInput(item.sku);
    } else {
      // Return scan safety gate validation checks
      const allocated = eventData?.itemsAllocated[item.id];
      const qtyCheckedOut = allocated?.qtyCheckedOut || 0;
      const qtyReturned = allocated?.qtyReturned || 0;
      const qtyDamaged = allocated?.qtyDamaged || 0;
      const qtyMissing = allocated?.qtyMissing || 0;
      const currentlyCheckedOut = qtyCheckedOut - (qtyReturned + qtyDamaged + qtyMissing);

      if (!allocated || currentlyCheckedOut <= 0) {
        setReturnMismatchedAlert(`Asset Mismatch: This item "${item.name}" was not checked out to this event.`);
        setActiveReturnItem(null);
        return;
      }

      setReturnQty(currentlyCheckedOut.toString());
      setActiveReturnItem(item);
      setScanReturnSkuInput(item.sku);
    }
  };

  // Handle manual SKU scan forms
  const handleCheckoutScan = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");
    setCheckoutSuccess("");
    setMatchedItem(null);

    const input = scanSkuInput.trim().toUpperCase();
    if (!input) return;

    const match = inventoryList.find(item => item.sku === input || item.id === scanSkuInput.trim());
    if (match) {
      setMatchedItem(match);
      setCheckoutQty("1");
    } else {
      setCheckoutError(`Barcode Mismatch: Asset with SKU or ID "${input}" not found in current inventory.`);
    }
  };

  // Confirm and submit transactional scan-out checkout
  const handleConfirmCheckout = async () => {
    if (!matchedItem || !workspaceId || !eventData) return;
    setCheckoutError("");
    setCheckoutSuccess("");

    const requestedQty = parseInt(checkoutQty);
    if (isNaN(requestedQty) || requestedQty <= 0) {
      setCheckoutError("Please enter a valid positive integer quantity.");
      return;
    }

    if (requestedQty > matchedItem.warehouseQty) {
      setCheckoutError(`Insufficient stock: Only ${matchedItem.warehouseQty} units available in warehouse.`);
      return;
    }

    setSubmittingCheckout(true);

    try {
      // Snapshot simulation path
      let snapshotUrl = "";
      if (checkoutSnapshot) {
        snapshotUrl = `https://firebasestorage.googleapis.com/v0/b/stetling-event-ops/o/snapshots%2F${Date.now()}_${checkoutSnapshot.name}?alt=media`;
      }

      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, "inventory", matchedItem.id);
        const eventRef = doc(db, "events", eventId);

        const freshItemSnap = await transaction.get(itemRef);
        const freshEventSnap = await transaction.get(eventRef);

        if (!freshItemSnap.exists()) throw new Error("Asset document not found.");
        if (!freshEventSnap.exists()) throw new Error("Event document not found.");

        const currentWarehouseQty = freshItemSnap.data().warehouseQty || 0;
        const currentDeployedQty = freshItemSnap.data().deployedQty || 0;

        if (currentWarehouseQty < requestedQty) {
          throw new Error("Insufficient stock in warehouse.");
        }

        // 1. Decrement warehouse, increment deployed
        transaction.update(itemRef, {
          warehouseQty: currentWarehouseQty - requestedQty,
          deployedQty: currentDeployedQty + requestedQty
        });

        // 2. Allocate inside Event
        const freshEventData = freshEventSnap.data() as EventItem;
        const itemsAllocated = freshEventData.itemsAllocated || {};
        const activeAlloc = itemsAllocated[matchedItem.id] || { qtyCheckedOut: 0, qtyReturned: 0, qtyDamaged: 0, qtyMissing: 0 };

        itemsAllocated[matchedItem.id] = {
          ...activeAlloc,
          qtyCheckedOut: activeAlloc.qtyCheckedOut + requestedQty
        };

        transaction.update(eventRef, { itemsAllocated });

        // 3. Write immutable log tracing operator
        const logId = `log_${Date.now()}_checkout`;
        const logRef = doc(db, "movement_logs", logId);
        transaction.set(logRef, {
          id: logId,
          actionType: "CHECKOUT",
          workspaceId,
          eventId,
          itemId: matchedItem.id,
          itemSku: matchedItem.sku,
          itemName: matchedItem.name,
          quantity: requestedQty,
          snapshotUrl,
          actionedBy: actionedByUid,
          actionedByName,
          createdAt: new Date().toISOString()
        });
      });

      setCheckoutSuccess(`Successfully allocated ${requestedQty} units to ${eventData.name}!`);
      setScanSkuInput("");
      setMatchedItem(null);
      setCheckoutQty("");
      setCheckoutSnapshot(null);

    } catch (err: any) {
      console.error("Scan-Out Checkout transaction aborted:", err);
      setCheckoutError(err.message || "An unexpected error occurred during check-out.");
    } finally {
      setSubmittingCheckout(false);
    }
  };

  // Scan-In returning barcode forms
  const handleReturnScanInput = (e: React.FormEvent) => {
    e.preventDefault();
    setReturnMismatchedAlert("");
    setActiveReturnItem(null);

    const input = scanReturnSkuInput.trim().toUpperCase();
    if (!input) return;

    const match = inventoryList.find(item => item.sku === input || item.id === scanReturnSkuInput.trim());
    if (!match) {
      setReturnMismatchedAlert(`Barcode Mismatch: Asset with SKU or ID "${input}" not found in current inventory.`);
      return;
    }

    const allocated = eventData?.itemsAllocated[match.id];
    const qtyCheckedOut = allocated?.qtyCheckedOut || 0;
    const qtyReturned = allocated?.qtyReturned || 0;
    const qtyDamaged = allocated?.qtyDamaged || 0;
    const qtyMissing = allocated?.qtyMissing || 0;
    const currentlyCheckedOut = qtyCheckedOut - (qtyReturned + qtyDamaged + qtyMissing);

    if (!allocated || currentlyCheckedOut <= 0) {
      setReturnMismatchedAlert(`Asset Mismatch: This item "${match.name}" was not checked out to this event.`);
      return;
    }

    setReturnQty(currentlyCheckedOut.toString());
    setActiveReturnItem(match);
  };

  // Discrepancy validation rule
  const isReturnLocked = () => {
    if (!activeReturnItem || !eventData) return true;
    const allocated = eventData.itemsAllocated[activeReturnItem.id];
    const qtyCheckedOut = allocated?.qtyCheckedOut || 0;
    const qtyReturned = allocated?.qtyReturned || 0;
    const qtyDamaged = allocated?.qtyDamaged || 0;
    const qtyMissing = allocated?.qtyMissing || 0;
    const currentlyCheckedOut = qtyCheckedOut - (qtyReturned + qtyDamaged + qtyMissing);

    const inputReturnQty = parseInt(returnQty);
    if (isNaN(inputReturnQty) || inputReturnQty <= 0) return true;

    const isShortQty = inputReturnQty < currentlyCheckedOut;
    const isGearDamaged = returnCondition === "Damaged";

    if (isShortQty || isGearDamaged) {
      return !returnNote.trim() || !returnPhoto;
    }

    return false;
  };

  // Process and submit Scan-In Return transaction
  const handleConfirmReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturnItem || !workspaceId || !eventData) return;
    setReturnError("");
    setReturnSuccess("");

    const returningQty = parseInt(returnQty);
    const allocated = eventData.itemsAllocated[activeReturnItem.id];
    const qtyCheckedOut = allocated?.qtyCheckedOut || 0;
    const qtyReturned = allocated?.qtyReturned || 0;
    const qtyDamaged = allocated?.qtyDamaged || 0;
    const qtyMissing = allocated?.qtyMissing || 0;
    const currentlyCheckedOut = qtyCheckedOut - (qtyReturned + qtyDamaged + qtyMissing);

    if (isNaN(returningQty) || returningQty <= 0) {
      setReturnError("Please enter a valid positive return quantity.");
      return;
    }

    if (returningQty > currentlyCheckedOut) {
      setReturnError(`Validation error: Returning quantity exceeds checked-out count (${currentlyCheckedOut}).`);
      return;
    }

    setSubmittingReturn(true);

    try {
      let photoUrl = "";
      if (returnPhoto) {
        photoUrl = `https://firebasestorage.googleapis.com/v0/b/stetling-event-ops/o/snapshots%2F${Date.now()}_${returnPhoto.name}?alt=media`;
      }

      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, "inventory", activeReturnItem.id);
        const eventRef = doc(db, "events", eventId);

        const freshItemSnap = await transaction.get(itemRef);
        const freshEventSnap = await transaction.get(eventRef);

        if (!freshItemSnap.exists()) throw new Error("Asset document not found.");
        if (!freshEventSnap.exists()) throw new Error("Event document not found.");

        const itemData = freshItemSnap.data();
        const freshEventData = freshEventSnap.data() as EventItem;

        const currentWarehouseQty = itemData.warehouseQty || 0;
        const currentDeployedQty = itemData.deployedQty || 0;
        const currentQuarantineQty = itemData.quarantineQty || 0;

        const deficitMissing = currentlyCheckedOut - returningQty;

        let addedToWarehouse = 0;
        let addedToQuarantine = 0;

        let incReturned = 0;
        let incDamaged = 0;
        let incMissing = 0;

        if (returnCondition === "Damaged") {
          addedToQuarantine = returningQty + deficitMissing;
          incDamaged = returningQty;
          incMissing = deficitMissing;
        } else {
          addedToWarehouse = returningQty;
          addedToQuarantine = deficitMissing;
          incReturned = returningQty;
          incMissing = deficitMissing;
        }

        // 1. Update stock levels atomically
        transaction.update(itemRef, {
          warehouseQty: currentWarehouseQty + addedToWarehouse,
          quarantineQty: currentQuarantineQty + addedToQuarantine,
          deployedQty: Math.max(0, currentDeployedQty - currentlyCheckedOut)
        });

        // 2. Track metrics inside Event allocations
        const itemsAllocated = freshEventData.itemsAllocated || {};
        const activeAlloc = itemsAllocated[activeReturnItem.id] || { qtyCheckedOut: 0, qtyReturned: 0, qtyDamaged: 0, qtyMissing: 0 };

        itemsAllocated[activeReturnItem.id] = {
          qtyCheckedOut: activeAlloc.qtyCheckedOut,
          qtyReturned: (activeAlloc.qtyReturned || 0) + incReturned,
          qtyDamaged: (activeAlloc.qtyDamaged || 0) + incDamaged,
          qtyMissing: (activeAlloc.qtyMissing || 0) + incMissing
        };

        transaction.update(eventRef, { itemsAllocated });

        // 3. Log return tracing operators
        const logId = `log_${Date.now()}_return`;
        const logRef = doc(db, "movement_logs", logId);
        transaction.set(logRef, {
          id: logId,
          actionType: "RETURN",
          workspaceId,
          eventId,
          itemId: activeReturnItem.id,
          itemSku: activeReturnItem.sku,
          itemName: activeReturnItem.name,
          quantity: returningQty,
          snapshotUrl: photoUrl,
          note: returnNote.trim() || `Processed returns: ${returnCondition}`,
          actionedBy: actionedByUid,
          actionedByName,
          createdAt: new Date().toISOString()
        });
      });

      setReturnSuccess(`Successfully processed returns for SKU: ${activeReturnItem.sku}!`);
      setActiveReturnItem(null);
      setReturnQty("");
      setReturnCondition("Excellent");
      setReturnNote("");
      setReturnPhoto(null);
      setScanReturnSkuInput("");

    } catch (err: any) {
      console.error("Return transaction failed:", err);
      setReturnError(err.message || "An error occurred during returning operations.");
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Undo transaction reversal audits
  const handleUndoTransaction = async (log: MovementLog) => {
    if (reversingId || !workspaceId || eventData?.status === "archived") return;
    setReversingId(log.id);

    try {
      await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, "inventory", log.itemId);
        const eventRef = doc(db, "events", eventId);

        const freshItemSnap = await transaction.get(itemRef);
        const freshEventSnap = await transaction.get(eventRef);

        if (!freshItemSnap.exists() || !freshEventSnap.exists()) {
          throw new Error("Required references missing.");
        }

        const itemData = freshItemSnap.data();
        const freshEventData = freshEventSnap.data() as EventItem;

        const currentWarehouse = itemData.warehouseQty || 0;
        const currentDeployed = itemData.deployedQty || 0;
        const currentQuarantine = itemData.quarantineQty || 0;

        const itemsAllocated = freshEventData.itemsAllocated || {};
        const activeAlloc = itemsAllocated[log.itemId] || { qtyCheckedOut: 0, qtyReturned: 0, qtyDamaged: 0, qtyMissing: 0 };

        if (log.actionType === "CHECKOUT") {
          if (currentDeployed < log.quantity) throw new Error("Deployment mismatch on reversal.");
          
          transaction.update(itemRef, {
            warehouseQty: currentWarehouse + log.quantity,
            deployedQty: currentDeployed - log.quantity
          });

          itemsAllocated[log.itemId] = {
            ...activeAlloc,
            qtyCheckedOut: Math.max(0, activeAlloc.qtyCheckedOut - log.quantity)
          };
          transaction.update(eventRef, { itemsAllocated });

        } else if (log.actionType === "RETURN") {
          // Reversing Return: Move returned count back to deployedQty, decrement warehouse and quarantine
          transaction.update(itemRef, {
            deployedQty: currentDeployed + log.quantity,
            warehouseQty: Math.max(0, currentWarehouse - log.quantity)
          });

          itemsAllocated[log.itemId] = {
            ...activeAlloc,
            qtyReturned: Math.max(0, (activeAlloc.qtyReturned || 0) - log.quantity)
          };
          transaction.update(eventRef, { itemsAllocated });
        }

        // Add corrective movements log
        const correctionId = `log_${Date.now()}_corr`;
        const correctionRef = doc(db, "movement_logs", correctionId);
        transaction.set(correctionRef, {
          id: correctionId,
          actionType: "AUDIT_CORRECTION",
          workspaceId,
          eventId,
          itemId: log.itemId,
          itemSku: log.itemSku,
          itemName: log.itemName,
          quantity: log.quantity,
          note: `ADMIN AUDIT CORRECTION: Undo log #${log.id.slice(-5)}`,
          actionedBy: actionedByUid,
          actionedByName,
          createdAt: new Date().toISOString()
        });
      });

    } catch (err: any) {
      console.error("Reversal failed:", err);
      alert(err.message || "An error occurred during reversing operations.");
    } finally {
      setReversingId(null);
    }
  };

  // Archive and Close out Event
  const handleCloseoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData || !workspaceId) return;

    if (totalCurrentlyDeployed > 0) {
      setCloseoutError("Closeout locked: Outstanding assets are active in the field.");
      return;
    }

    const requiresNotes = totalMissingCounts + totalDamagedCounts > 0;
    if (requiresNotes && !closeoutNotesInput.trim()) {
      setCloseoutError("Notes required: Please document discrepancy resolution summaries.");
      return;
    }

    setSubmittingCloseout(true);
    setCloseoutError("");

    try {
      await runTransaction(db, async (transaction) => {
        const eventRef = doc(db, "events", eventId);
        const freshEventSnap = await transaction.get(eventRef);

        if (!freshEventSnap.exists()) throw new Error("Event folder not found.");

        transaction.update(eventRef, {
          status: "archived",
          closeoutNotes: closeoutNotesInput.trim() || "No discrepancies reported.",
          updatedAt: new Date().toISOString()
        });

        // Write an unalterable closing log
        const logId = `log_${Date.now()}_closeout`;
        const logRef = doc(db, "movement_logs", logId);
        transaction.set(logRef, {
          id: logId,
          actionType: "AUDIT_CORRECTION",
          workspaceId,
          eventId,
          itemId: "N/A",
          itemSku: "N/A",
          itemName: "Event Close Out",
          quantity: 0,
          note: `EVENT CLOSED OUT: ${closeoutNotesInput.trim() || "Clean closeout"}`,
          actionedBy: actionedByUid,
          actionedByName,
          createdAt: new Date().toISOString()
        });
      });

      setIsCloseoutOpen(false);
      setCloseoutNotesInput("");

    } catch (err: any) {
      console.error("Closeout failed:", err);
      setCloseoutError(err.message || "An error occurred during event archiving.");
    } finally {
      setSubmittingCloseout(false);
    }
  };

  // --- MATHEMATICAL COMPILATIONS (LIVE OVERVIEW PANEL) ---
  let totalAllocatedAssets = 0;
  let totalCurrentlyDeployed = 0;
  let totalDamagedCounts = 0;
  let totalMissingCounts = 0;
  let totalFinancialRisk = 0;

  if (eventData) {
    Object.entries(eventData.itemsAllocated).forEach(([itemId, alloc]) => {
      const invItem = inventoryList.find(item => item.id === itemId);
      const replacementValue = invItem?.replacementValue || 0;

      const qtyCheckedOut = alloc.qtyCheckedOut || 0;
      const qtyReturned = alloc.qtyReturned || 0;
      const qtyDamaged = alloc.qtyDamaged || 0;
      const qtyMissing = alloc.qtyMissing || 0;

      const remainingActive = qtyCheckedOut - (qtyReturned + qtyDamaged + qtyMissing);

      totalAllocatedAssets += qtyCheckedOut;
      totalCurrentlyDeployed += remainingActive;
      totalDamagedCounts += qtyDamaged;
      totalMissingCounts += qtyMissing;

      // Risk cost = (damaged + missing) * replacement value
      totalFinancialRisk += (qtyDamaged + qtyMissing) * replacementValue;
    });
  }

  // Deployed list
  const deployedItemsList = eventData
    ? Object.entries(eventData.itemsAllocated)
        .map(([itemId, alloc]) => {
          const invItem = inventoryList.find(item => item.id === itemId);
          const remainingCheckedOut = (alloc.qtyCheckedOut || 0) - ((alloc.qtyReturned || 0) + (alloc.qtyDamaged || 0) + (alloc.qtyMissing || 0));
          if (!invItem || remainingCheckedOut <= 0) return null;
          return {
            ...invItem,
            qtyCheckedOut: alloc.qtyCheckedOut,
            qtyReturned: alloc.qtyReturned || 0,
            qtyDamaged: alloc.qtyDamaged || 0,
            qtyMissing: alloc.qtyMissing || 0,
            remainingCheckedOut
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : [];

  const isArchived = eventData?.status === "archived";
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  if (authLoading || loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 text-white z-50">
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border-t-2 border-b-2 border-indigo-500 animate-spin absolute" />
          <div className="w-12 h-12 rounded-full border-r-2 border-l-2 border-cyan-400 animate-spin absolute duration-1000" />
          <Sparkles className="size-6 text-indigo-400 animate-pulse" />
        </div>
        <p className="mt-8 text-sm font-semibold tracking-wider text-zinc-400 font-heading uppercase animate-pulse">
          Opening Event Mission Control...
        </p>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-4 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="text-lg font-bold font-heading">Event Folder Not Found</h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm mb-6">
          This project directory does not exist or has been archived from your multi-tenant workspace registry.
        </p>
        <Button onClick={() => router.push("/dashboard/events")} variant="outline" className="border-zinc-800 text-zinc-300">
          <ArrowLeft className="size-4 mr-2" />
          Back to Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans overflow-x-hidden relative">
      
      {/* Visual ambient background lights */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* HEADER BAR SECTION */}
      <header className="sticky top-0 z-30 border-b border-zinc-850 bg-zinc-950/95 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => router.push("/dashboard/events")}
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white hover:bg-zinc-900 h-9 p-2.5 border-zinc-850"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Events
          </Button>
          <div className="h-6 w-[1px] bg-zinc-800" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white font-heading uppercase flex items-center gap-2">
              {eventData.name}
              <span className={`text-[10px] border px-2 py-0.5 rounded font-mono font-bold uppercase ${
                isArchived 
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 animate-pulse"
              }`}>
                {eventData.status}
              </span>
            </h1>
            <span className="text-[10px] text-zinc-500 font-mono tracking-wide">{eventData.location}</span>
          </div>
        </div>

        {/* CLOSE OUT / END EVENT CONTROLS */}
        <div className="flex items-center gap-3">
          {!isArchived ? (
            <Button 
              onClick={() => {
                setCloseoutError("");
                setIsCloseoutOpen(true);
              }}
              disabled={totalCurrentlyDeployed > 0 || !isAdmin}
              className={`h-9 font-extrabold uppercase text-[10px] tracking-wider border-none shadow-lg ${
                totalCurrentlyDeployed > 0 || !isAdmin
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
                  : "bg-gradient-to-r from-red-600 to-amber-600 hover:opacity-95 text-white shadow-red-600/10"
              }`}
            >
              <FileSignature className="size-3.5 mr-1.5" />
              Close Out Event
            </Button>
          ) : (
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-700/60 font-black uppercase flex items-center gap-1.5">
              <Lock className="size-3.5" />
              Archived & Sealed
            </span>
          )}
        </div>
      </header>

      {/* OPERATION METRICS HIGH-LEVEL PANEL */}
      <section className="max-w-7xl w-full mx-auto px-6 pt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* STAT 1 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Total Allocated Assets</span>
            <h3 className="text-2xl font-black font-heading tracking-tight text-white mt-1">
              {totalAllocatedAssets}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
            <Layers className="size-5" />
          </div>
        </div>

        {/* STAT 2 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Currently Deployed</span>
            <h3 className="text-2xl font-black font-heading tracking-tight text-cyan-400 mt-1">
              {totalCurrentlyDeployed}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <PackageCheck className="size-5 animate-pulse" />
          </div>
        </div>

        {/* STAT 3 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Missing / Damaged</span>
            <h3 className="text-2xl font-black font-heading tracking-tight text-red-400 mt-1">
              {totalMissingCounts + totalDamagedCounts}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <TrendingDown className="size-5" />
          </div>
        </div>

        {/* STAT 4 */}
        <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 backdrop-blur-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">Financial Risk Impact</span>
            <h3 className="text-2xl font-black font-heading tracking-tight text-amber-500 mt-1">
              ₦{totalFinancialRisk.toLocaleString()}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
            <DollarSign className="size-5" />
          </div>
        </div>

      </section>

      {/* MAIN MISSION CONTROL AREA */}
      <main className="max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 z-10 relative flex-1">
        
        {/* LEFT TWO-THIRDS: SCANNERS & FORMS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB SWITCHERS */}
          <div className="bg-zinc-900/60 border border-zinc-850 p-1.5 rounded-xl flex">
            <button 
              onClick={() => {
                if (isArchived) return;
                setActiveTab("checkout");
                setMatchedItem(null);
                setScanSkuInput("");
              }}
              disabled={isArchived}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === "checkout" 
                  ? "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-600/10" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
              }`}
            >
              <PackageCheck className="size-4" />
              Scan-Out (Checkout)
            </button>
            <button 
              onClick={() => {
                if (isArchived) return;
                setActiveTab("return");
                setActiveReturnItem(null);
                setScanReturnSkuInput("");
              }}
              disabled={isArchived}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                activeTab === "return" 
                  ? "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-600/10" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
              }`}
            >
              <Undo2 className="size-4" />
              Scan-In (Return)
            </button>
          </div>

          {/* READ-ONLY STATE BARRIER IF ARCHIVED */}
          {isArchived && (
            <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 text-center shadow-xl space-y-3">
              <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-450 mx-auto animate-pulse">
                <Lock className="size-6" />
              </div>
              <h4 className="text-base font-semibold text-zinc-200 font-heading">
                Operational Dashboard Locked
              </h4>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                This deployment folder is fully completed, approved, and archived in historical archives. All checkout and return pipelines are permanently sealed.
              </p>
              {eventData.closeoutNotes && (
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 text-left max-w-xl mx-auto space-y-1 mt-4">
                  <span className="text-[10px] text-zinc-500 uppercase font-black block flex items-center gap-1">
                    <FileSignature className="size-3.5" />
                    Closeout Note Records
                  </span>
                  <p className="text-xs text-zinc-400 italic leading-relaxed">
                    "{eventData.closeoutNotes}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB A: SCAN OUT (CHECKOUT) */}
          {!isArchived && activeTab === "checkout" && (
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-indigo-600" />
              
              <div className="space-y-1">
                <h3 className="text-base font-bold font-heading text-white uppercase flex items-center gap-2">
                  <PackageCheck className="size-5 text-indigo-400" />
                  Asset Scan-Out (Checkout)
                </h3>
                <p className="text-xs text-zinc-400">
                  Simulate scanning QR Codes or barcode tags to check-out inventory.
                </p>
              </div>

              {/* DUAL INPUT CONTROLS BAR */}
              <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleCheckoutScan} className="flex-1 flex gap-3">
                  <div className="relative flex-1">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Enter SKU manually or scan barcode (e.g. SPK-JBL-SRX828)..." 
                      value={scanSkuInput}
                      onChange={(e) => setScanSkuInput(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <Button type="submit" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 font-bold h-10 px-4">
                    Lookup
                  </Button>
                </form>

                {/* Device Camera Scanner Access trigger */}
                <Button 
                  onClick={() => startCameraStream("checkout")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase h-10 tracking-wider cursor-pointer"
                >
                  <QrCode className="size-4 mr-2" />
                  Scan Live Camera
                </Button>
              </div>

              {/* FEEDBACK FEED */}
              {checkoutError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {checkoutSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>{checkoutSuccess}</span>
                </div>
              )}

              {/* BATCH QUANTITY CONFIRMATION CARD */}
              {matchedItem && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-5 animate-in zoom-in-95 duration-200">
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded uppercase tracking-wider font-extrabold flex items-center w-fit gap-1 animate-pulse">
                    <Sparkles className="size-3.5" />
                    Asset Match Resolved
                  </span>

                  {/* Asset Details */}
                  <div className="grid grid-cols-2 gap-4 border-b border-zinc-850 pb-4">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">Asset Name</span>
                      <strong className="text-white text-sm block mt-0.5">{matchedItem.name}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase font-bold block">SKU Code</span>
                      <code className="text-xs font-mono font-extrabold text-indigo-300 block mt-0.5">{matchedItem.sku}</code>
                    </div>
                  </div>

                  {/* Balance levels */}
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex flex-col justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">Warehouse Stock:</span>
                      <strong className="text-emerald-400 font-black mt-1 text-sm">{matchedItem.warehouseQty}</strong>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex flex-col justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold">UOM:</span>
                      <span className="text-white uppercase font-black mt-1">{matchedItem.unitOfMeasure}</span>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 flex flex-col justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase font-bold font-mono">Value (₦):</span>
                      <span className="text-amber-500 font-black mt-1">₦{matchedItem.replacementValue.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Action inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Batch Qty input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-300 block">Allocation Batch Quantity</label>
                      <input 
                        type="number" 
                        min="1" 
                        max={matchedItem.warehouseQty}
                        value={checkoutQty}
                        onChange={(e) => setCheckoutQty(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Snapshot file upload */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-300 block flex items-center gap-1">
                        <Upload className="size-3.5 text-zinc-500" />
                        State Tracking Snapshot
                      </label>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => setCheckoutSnapshot(e.target.files ? e.target.files[0] : null)}
                          className="hidden" 
                          id="checkout-file-upload"
                        />
                        <label 
                          htmlFor="checkout-file-upload"
                          className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-750 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="truncate max-w-[80%] font-mono">
                            {checkoutSnapshot ? checkoutSnapshot.name : "Select Snapshot (Optional)..."}
                          </span>
                          <FileImage className="size-4 text-zinc-500 shrink-0" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SCAN-OUT CONFIRMATION GATE TRIGGER */}
                  <div className="pt-3 border-t border-zinc-850">
                    <Button 
                      onClick={handleConfirmCheckout}
                      disabled={submittingCheckout}
                      className="w-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-extrabold hover:opacity-95 shadow-lg shadow-indigo-600/10 h-11 border-none cursor-pointer"
                    >
                      {submittingCheckout ? (
                        <>
                          <RefreshCw className="size-4 mr-2 animate-spin text-white" />
                          Allocating Assets...
                        </>
                      ) : (
                        <>
                          Confirm Allocation to {eventData.name}
                          <ArrowRight className="size-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB B: SCAN IN (RETURN) */}
          {!isArchived && activeTab === "return" && (
            <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-indigo-600" />

              <div className="space-y-1">
                <h3 className="text-base font-bold font-heading text-white uppercase flex items-center gap-2">
                  <Undo2 className="size-5 text-indigo-400" />
                  Asset Scan-In (Return)
                </h3>
                <p className="text-xs text-zinc-400">
                  Scan returning barcodes or select checked-out gear from the table to log return baselines.
                </p>
              </div>

              {/* DUAL INPUT CONTROLS BAR */}
              <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleReturnScanInput} className="flex-1 flex gap-3">
                  <div className="relative flex-1">
                    <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Scan returning item SKU or ID code..." 
                      value={scanReturnSkuInput}
                      onChange={(e) => setScanReturnSkuInput(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 pl-10 pr-4 text-xs text-white placeholder-zinc-650 outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <Button type="submit" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 font-bold h-10 px-4">
                    Lookup
                  </Button>
                </form>

                {/* Live camera scan trigger */}
                <Button 
                  onClick={() => startCameraStream("return")}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase h-10 tracking-wider cursor-pointer"
                >
                  <QrCode className="size-4 mr-2" />
                  Scan Live Camera
                </Button>
              </div>

              {/* SCAN-IN SAFETY GATE MISMATCH FEEDBACK */}
              {returnMismatchedAlert && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-4 text-xs flex items-start gap-3 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5 animate-bounce text-red-400" />
                  <div className="space-y-1">
                    <span className="font-bold block">Asset mismatch: Allocation locked.</span>
                    <span className="text-red-300/85 block">{returnMismatchedAlert}</span>
                  </div>
                </div>
              )}

              {returnSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                  <span>{returnSuccess}</span>
                </div>
              )}

              {/* CONFIRMATION RETURN DIALOG OVERLAY CARD */}
              {activeReturnItem && (
                <form onSubmit={handleConfirmReturnSubmit} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                    <span className="text-xs font-extrabold text-white uppercase block">
                      Process Return Checklist: {activeReturnItem.sku}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setActiveReturnItem(null);
                        setReturnMismatchedAlert("");
                      }}
                      className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Return item name */}
                  <div className="text-xs">
                    <span className="text-zinc-500">Asset:</span> <strong className="text-white">{activeReturnItem.name}</strong>
                  </div>

                  {/* Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Returning Quantity */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-300 block">Returning Quantity</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={returnQty}
                        onChange={(e) => setReturnQty(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Condition Picker */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-zinc-300 block">Evaluated Condition</label>
                      <select 
                        value={returnCondition}
                        onChange={(e) => setReturnCondition(e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="Excellent">Excellent</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Damaged">Damaged</option>
                      </select>
                    </div>
                  </div>

                  {/* DISCREPANCY DETECTED SUB CARD & LOCKDOWN RULE */}
                  {(() => {
                    const allocated = eventData.itemsAllocated[activeReturnItem.id];
                    const qtyCheckedOut = allocated?.qtyCheckedOut || 0;
                    const qtyReturned = allocated?.qtyReturned || 0;
                    const qtyDamaged = allocated?.qtyDamaged || 0;
                    const qtyMissing = allocated?.qtyMissing || 0;
                    const currentlyCheckedOut = qtyCheckedOut - (qtyReturned + qtyDamaged + qtyMissing);
                    const parsedQty = parseInt(returnQty);
                    
                    const isShort = !isNaN(parsedQty) && parsedQty < currentlyCheckedOut;
                    const isDamaged = returnCondition === "Damaged";

                    if (isShort || isDamaged) {
                      return (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2">
                          <div className="flex items-start gap-2.5 text-xs text-amber-400 font-semibold leading-relaxed">
                            <Lock className="size-4 shrink-0 mt-0.5 animate-pulse" />
                            <div className="space-y-1">
                              <span className="block font-bold">DISCREPANCY DETECTED — SUBMIT LOCKED</span>
                              <p className="text-amber-300/80 text-[10.5px] font-medium leading-normal">
                                {isShort && `Deficit detected: Checking in only ${parsedQty} out of ${currentlyCheckedOut} allocated items. `}
                                {isDamaged && `Baseline condition is Damaged. `}
                                You must supply detailed text damage/loss descriptions and attach a damage/loss photograph file to unlock the transactional submit gate.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 pt-1 border-t border-amber-500/10">
                            {/* Required discrepancy text notes */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-amber-400 uppercase">Text Damage/Loss Descriptions *</label>
                              <textarea 
                                required
                                value={returnNote}
                                onChange={(e) => setReturnNote(e.target.value)}
                                placeholder="State exact locations of damages, missing items reasons, or notes..."
                                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/50 rounded-lg p-2 text-xs text-white placeholder-zinc-700 outline-none min-h-[60px]"
                              />
                            </div>

                            {/* Required damage file upload */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-amber-400 uppercase">Damage / Loss Photo Snapshot *</label>
                              <div>
                                <input 
                                  type="file" 
                                  accept="image/*"
                                  required
                                  onChange={(e) => setReturnPhoto(e.target.files ? e.target.files[0] : null)}
                                  className="hidden" 
                                  id="return-file-upload"
                                />
                                <label 
                                  htmlFor="return-file-upload"
                                  className="w-full bg-zinc-950 border border-zinc-800 hover:border-zinc-750 rounded-lg p-2.5 text-xs text-zinc-400 hover:text-white flex items-center justify-between cursor-pointer transition-colors"
                                >
                                  <span className="truncate max-w-[80%] font-mono">
                                    {returnPhoto ? returnPhoto.name : "Select photo to upload..."}
                                  </span>
                                  <FileImage className="size-4 text-zinc-500 shrink-0" />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Submit controls */}
                  {returnError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      <span>{returnError}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-zinc-850 flex gap-3">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setActiveReturnItem(null)}
                      className="flex-1 border-zinc-800 text-zinc-400 h-10"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={submittingReturn || isReturnLocked()}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-bold hover:opacity-95 shadow-lg h-10 border-none disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {submittingReturn ? (
                        <>
                          <RefreshCw className="size-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Process Return
                          <ArrowRight className="size-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </div>

                </form>
              )}

              {/* ALLOCATED GEAR TABLES */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Allocated Gear Deployment Checklist
                </h4>

                {deployedItemsList.length === 0 ? (
                  <div className="bg-zinc-900/10 border border-zinc-850 rounded-xl py-8 px-4 text-center text-xs text-zinc-500">
                    All checkouts are accounted for. No gear currently deployed.
                  </div>
                ) : (
                  <div className="border border-zinc-850 rounded-xl overflow-hidden divide-y divide-zinc-850/40 bg-zinc-900/10 text-xs">
                    {deployedItemsList.map((item) => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/20 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <code className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/20 border border-indigo-900/25 px-1.5 py-0.5 rounded">
                              {item.sku}
                            </code>
                            <strong className="text-white font-semibold">{item.name}</strong>
                          </div>
                          <div className="text-zinc-500 text-[10px]">
                            Checked-out: <strong className="text-zinc-300">{item.qtyCheckedOut}</strong> | Returned: <strong className="text-emerald-400">{item.qtyReturned}</strong> | Damaged: <strong className="text-red-400">{item.qtyDamaged}</strong> | Missing: <strong className="text-amber-500">{item.qtyMissing}</strong> | Active: <strong className="text-indigo-400">{item.remainingCheckedOut}</strong>
                          </div>
                        </div>
                        <Button 
                          onClick={() => {
                            setReturnQty(item.remainingCheckedOut.toString());
                            setActiveReturnItem(item);
                            setReturnMismatchedAlert("");
                          }}
                          size="xs"
                          variant="ghost"
                          className="text-indigo-400 hover:text-white hover:bg-zinc-900 border-zinc-800 shrink-0 font-bold uppercase text-[9px] tracking-wider"
                        >
                          Return Gear
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: REAL-TIME MOVEMENT LOGS WITH REVERSALS */}
        <div className="space-y-6">
          
          <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-indigo-600" />

            <div className="space-y-1.5 pb-4 border-b border-zinc-850">
              <h3 className="text-xs font-black tracking-wider text-white uppercase flex items-center gap-2">
                <FileText className="size-4.5 text-indigo-400" />
                Immutable Audit Trails
              </h3>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Legally unalterable movements log recorded in the `movement_logs` collection.
              </p>
            </div>

            {/* Logs activity lists */}
            <div className="mt-4 space-y-4 max-h-[550px] overflow-y-auto pr-1">
              {activityLogs.length === 0 ? (
                <div className="py-20 text-center text-xs text-zinc-650">
                  No activity movement records logged for this deployment.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 hover:border-zinc-850 flex flex-col justify-between gap-3 text-[11px] animate-in slide-in-from-right-3 transition-colors"
                  >
                    {/* Log header */}
                    <div className="flex justify-between items-start gap-1">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border ${
                        log.actionType === "CHECKOUT"
                          ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                          : log.actionType === "RETURN"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      }`}>
                        {log.actionType}
                      </span>
                      <span className="text-[9.5px] text-zinc-550 font-mono">
                        {new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    {/* Operator Tracing output */}
                    <div className="space-y-1 text-zinc-350">
                      <div>
                        Asset SKU: <strong className="text-white font-bold font-mono">{log.itemSku}</strong>
                      </div>
                      <div className="line-clamp-1 font-medium">{log.itemName}</div>
                      
                      {/* Operator signature */}
                      <div className="text-[10.5px] text-zinc-400 flex items-center gap-1">
                        <UserCheck className="size-3.5 text-zinc-500 shrink-0" />
                        <span>
                          {log.quantity} units {log.actionType.toLowerCase() === "checkout" ? "checked out" : log.actionType.toLowerCase() === "return" ? "returned" : "reversed"} by{" "}
                          <strong className="text-indigo-300 font-semibold">{log.actionedByName || "Operator"}</strong>
                        </span>
                      </div>
                      
                      {log.note && (
                        <p className="text-[10px] italic text-zinc-500 bg-zinc-900/30 p-1.5 rounded border border-zinc-900/60 mt-1 leading-relaxed">
                          Note: {log.note}
                        </p>
                      )}

                      {/* IN-APP IMAGE DIALOG MODAL VIEW TRIGGER (Eliminating <a> tab redirects) */}
                      {log.snapshotUrl && (
                        <button 
                          onClick={() => setActiveZoomUrl(log.snapshotUrl || null)}
                          className="text-[9.5px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 mt-1 font-bold bg-transparent border-none cursor-pointer"
                        >
                          <FileImage className="size-3.5" />
                          View Snapshot Proof
                        </button>
                      )}
                    </div>

                    {/* Admin Undo Button (reversal pipeline) */}
                    {log.actionType !== "AUDIT_CORRECTION" && !isArchived && (
                      <div className="pt-2 border-t border-zinc-900/80 flex items-center justify-between">
                        <span className="text-[9px] text-zinc-500 font-mono">
                          ID: #{log.id.slice(-5)}
                        </span>
                        
                        <Button 
                          onClick={() => handleUndoTransaction(log)}
                          disabled={reversingId !== null || !isAdmin}
                          size="xs"
                          variant="ghost"
                          className="h-6 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/5 font-extrabold text-[9px] uppercase tracking-wider shrink-0"
                        >
                          {reversingId === log.id ? (
                            <RefreshCw className="size-3.5 animate-spin mr-1 text-amber-500" />
                          ) : (
                            <Undo2 className="size-3 mr-1" />
                          )}
                          Undo Action
                        </Button>
                      </div>
                    )}

                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </main>

      {/* --- 1. DEVICE CAMERA SCANNER DIALOG MODAL --- */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Ambient indicator */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400" />

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-heading uppercase">
                  Scanner Live Device Camera
                </h3>
              </div>
              <button 
                onClick={stopCameraStream}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Secure context warning banner */}
            {!isSecureContext && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 text-xs flex items-start gap-2.5 mx-6 mt-4 rounded-xl animate-in slide-in-from-top-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Insecure Connection Warning</span>
                  <p className="text-[10px] text-amber-300/80 leading-normal font-medium">
                    Webcam scanning requires an HTTPS connection or localhost to operate securely.
                  </p>
                </div>
              </div>
            )}

            {/* Video Viewport & Scanning Overlay */}
            <div className="p-6 space-y-6">
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-inner flex items-center justify-center">
                
                {/* Sweep laser line animation */}
                <div className="absolute inset-0 border-[2px] border-indigo-500/20 m-6 rounded-lg pointer-events-none flex items-center justify-center">
                  <div className="w-[80%] h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_#22d3ee] animate-pulse" />
                </div>

                <video 
                  ref={videoRef}
                  autoPlay={true}
                  playsInline={true}
                  className="w-full h-full object-cover"
                />

                {/* If stream failed */}
                {(!activeCameraStream || cameraErrorMsg) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 space-y-2 bg-zinc-950/90 z-20">
                    <AlertTriangle className="size-8 text-amber-500 animate-bounce" />
                    <span className="text-xs text-zinc-300 font-bold">Live Camera Feed Unavailable</span>
                    <p className="text-[10.5px] text-zinc-400 max-w-xs leading-normal font-medium">
                      {cameraErrorMsg || "Webcam scanning requires an HTTPS connection or localhost to operate securely."}
                    </p>
                    <p className="text-[10px] text-indigo-400 font-bold max-w-xs leading-normal pt-1.5 animate-pulse">
                      You can click any of the inventory targets below to immediately simulate barcode/QR scans!
                    </p>
                  </div>
                )}
              </div>

              {/* SIMULATOR CLICK OPTIONS */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
                  Scan Simulation Targets (Click to Scan):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[140px] overflow-y-auto pr-1">
                  {inventoryList.map((item) => (
                    <button 
                      key={item.id}
                      type="button"
                      onClick={() => handleSimulateScan(item)}
                      className="p-2 bg-zinc-950 hover:bg-indigo-950/20 border border-zinc-850 hover:border-indigo-900/30 rounded-lg text-[10.5px] text-zinc-400 hover:text-indigo-300 font-mono text-left font-bold transition-all truncate"
                    >
                      [{item.sku}] {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Close */}
              <div className="border-t border-zinc-800 pt-4">
                <Button 
                  onClick={stopCameraStream}
                  className="w-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 font-bold h-10 border-none"
                >
                  Close Scanner
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- 2. IN-APP IMAGE LIGHTBOX MODAL --- */}
      {activeZoomUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-2xl bg-zinc-950/90 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-3xl w-full bg-zinc-900 border border-zinc-850 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-850 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-zinc-400 font-mono flex items-center gap-1.5">
                <FileImage className="size-4 text-indigo-400" />
                Snapshot Verification Proof Image
              </span>
              <button 
                onClick={() => setActiveZoomUrl(null)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Image viewport */}
            <div className="p-4 bg-zinc-950 flex items-center justify-center aspect-video relative">
              <img 
                src={activeZoomUrl} 
                alt="Verification Proof" 
                className="max-h-[500px] object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-850 bg-zinc-900/50 flex justify-end">
              <Button 
                onClick={() => setActiveZoomUrl(null)}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold h-9 text-xs"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- 3. CLOSE OUT EVENT (END EVENT) LIFECYCLE MODAL --- */}
      {isCloseoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-zinc-950/80 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Top red alert bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-red-500 to-amber-500" />

            {/* Header */}
            <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="size-5 text-red-400" />
                <h3 className="text-sm font-bold text-white font-heading uppercase">
                  Close Out & Seal Event Folder
                </h3>
              </div>
              <button 
                onClick={() => setIsCloseoutOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCloseoutSubmit} className="p-6 space-y-4">
              
              <div className="text-xs text-zinc-400 leading-relaxed">
                You are about to close out, archive, and permanently lock deployment folder <strong className="text-white">"{eventData.name}"</strong>. This will freeze all allocations and operations.
              </div>

              {/* Warnings details if discrepancy exists */}
              {totalMissingCounts + totalDamagedCounts > 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-400 font-bold">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 animate-pulse" />
                    <span>OUTSTANDING DISCREPANCIES RECORDED</span>
                  </div>
                  <p className="text-[10.5px] text-amber-300/80 leading-normal font-medium">
                    This event is wrapping up with <strong className="text-white">{totalMissingCounts} lost</strong> and <strong className="text-white">{totalDamagedCounts} damaged</strong> items, causing an estimated financial risk impact of <strong className="text-white">₦{totalFinancialRisk.toLocaleString()}</strong>.
                  </p>
                  
                  {/* Notes input */}
                  <div className="space-y-1.5 pt-2 border-t border-amber-500/15">
                    <label className="text-[10px] font-bold text-amber-400 uppercase">Discrepancy Resolution Closeout Note *</label>
                    <textarea 
                      required
                      value={closeoutNotesInput}
                      onChange={(e) => setCloseoutNotesInput(e.target.value)}
                      placeholder="Detail insurance reports, claims actions, client billing terms, or loss approvals..."
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500/50 rounded-lg p-2.5 text-xs text-white placeholder-zinc-700 outline-none min-h-[80px]"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-4 text-xs flex items-center gap-2.5 font-bold">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <span>CLEAN CLOSE OUT: 100% of gear successfully returned intact!</span>
                </div>
              )}

              {closeoutError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{closeoutError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsCloseoutOpen(false)}
                  disabled={submittingCloseout}
                  className="flex-1 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white h-11"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={submittingCloseout}
                  className="flex-1 bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold hover:opacity-95 shadow-lg h-11 border-none cursor-pointer"
                >
                  {submittingCloseout ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    "Confirm Archive"
                  )}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
