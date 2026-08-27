"use client";

import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, runTransaction, collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
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
  DollarSign,
  MapPin,
  Calendar,
  Clock,
  Camera
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
  const [lastScannedRawValue, setLastScannedRawValue] = useState<string>("");
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const checkoutQtyInputRef = useRef<HTMLInputElement | null>(null);
  const returnQtyInputRef = useRef<HTMLInputElement | null>(null);

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

  // Auto-focus useEffect for Checkout Quantity Input
  useEffect(() => {
    if (matchedItem) {
      setTimeout(() => {
        if (checkoutQtyInputRef.current) {
          checkoutQtyInputRef.current.focus();
          checkoutQtyInputRef.current.select();
        }
      }, 150);
    }
  }, [matchedItem]);

  // Auto-focus useEffect for Return Quantity Input
  useEffect(() => {
    if (activeReturnItem) {
      setTimeout(() => {
        if (returnQtyInputRef.current) {
          returnQtyInputRef.current.focus();
          returnQtyInputRef.current.select();
        }
      }, 150);
    }
  }, [activeReturnItem]);

  // Debounce self-cleaning lock tracker
  useEffect(() => {
    if (!matchedItem && !activeReturnItem) {
      setIsProcessingScan(false);
    }
  }, [matchedItem, activeReturnItem]);

  // Operator credentials
  const actionedByName = user?.displayName || user?.email?.split("@")[0] || "Operator Staff";
  const actionedByUid = user?.uid || "unknown";

  // Check if current user is admin/superadmin
  useEffect(() => {
    if (!user) return;
    
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
      setIsSecureContext(window.isSecureContext);
    }
  }, []);

  useEffect(() => {
    if (!isScannerOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
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
    let intervalId: any = null;

    const startStream = async () => {
      setCameraErrorMsg("");
      try {
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
          }
          setCameraErrorMsg("");
          setActiveCameraStream(stream);

          intervalId = setInterval(async () => {
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
            if (videoRef.current.readyState >= 2) {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = videoRef.current.videoWidth || 640;
                canvas.height = videoRef.current.videoHeight || 480;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

                  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
                    // @ts-ignore
                    const detector = new window.BarcodeDetector({
                      formats: ["qr_code", "code_128", "ean_13", "code_39"]
                    });
                    const barcodes = await detector.detect(canvas);
                    if (barcodes && barcodes.length > 0) {
                      const detectedValue = barcodes[0].rawValue;
                      processScanSuccess(detectedValue);
                    }
                  }
                }
              } catch (drawErr) {
                console.warn("Canvas draw frame or native decode failed in background loop:", drawErr);
              }
            }
          }, 250);
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
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
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

  // Tab-Aware Automatic Scanning Logic
  const processScanSuccess = async (payload: string) => {
    if (isProcessingScan) return;

    try {
      setIsProcessingScan(true);
      setLastScannedRawValue(payload);

      let scannedSku = payload.trim();
      let scannedId = "";

      try {
        if (payload.trim().startsWith("{") && payload.trim().endsWith("}")) {
          const parsed = JSON.parse(payload);
          if (parsed && typeof parsed === "object") {
            if (parsed.sku) scannedSku = String(parsed.sku).trim();
            if (parsed.itemId) scannedId = String(parsed.itemId).trim();
          }
        }
      } catch (jsonErr) {
        scannedSku = payload.trim();
      }

      stopCameraStream();

      const match = inventoryList.find(
        (item) => 
          item.sku.toUpperCase() === scannedSku.toUpperCase() || 
          item.id === scannedId || 
          item.id === scannedSku
      );

      if (activeTab === "checkout") {
        setCheckoutError("");
        setCheckoutSuccess("");
        
        if (!match) {
          setCheckoutError(`Barcode Mismatch: Asset with SKU/ID "${scannedSku}" not found in current inventory.`);
          setIsProcessingScan(false);
          return;
        }

        setMatchedItem(match);
        setCheckoutQty("1");
        setScanSkuInput(match.sku);
      } else {
        setReturnMismatchedAlert("");
        setReturnSuccess("");

        if (!match) {
          setReturnMismatchedAlert(`Barcode Mismatch: Asset with SKU/ID "${scannedSku}" not found in current inventory.`);
          setIsProcessingScan(false);
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
          setActiveReturnItem(null);
          setIsProcessingScan(false);
          return;
        }

        setReturnQty(currentlyCheckedOut.toString());
        setReturnCondition("Excellent");
        setReturnNote("");
        setReturnPhoto(null);
        setActiveReturnItem(match);
        setScanReturnSkuInput(match.sku);
      }
    } catch (generalErr) {
      console.error("Critical error in scan resolution callback sequence:", generalErr);
      setIsProcessingScan(false);
    }
  };

  const handleSimulateScan = (item: InventoryItem) => {
    processScanSuccess(item.sku);
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

        // Write closing log
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

  // --- MATHEMATICAL COMPILATIONS ---
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
      <div className="flex-1 h-full min-h-[50vh] flex flex-col items-center justify-center">
        <div className="size-10 rounded-full border-3 border-[#800080]/20 border-t-[#800080] animate-spin" />
        <p className="mt-4 text-xs font-semibold tracking-wide text-neutral-500 font-sans">
          Opening Event Workspace...
        </p>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="flex-1 min-h-[50vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="size-12 rounded-full bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-neutral-900 font-sans">Event Not Found</h3>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm mb-6">
          This event does not exist or has been archived from your workspace.
        </p>
        <Button onClick={() => router.push("/dashboard/events")} variant="outline" className="border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl">
          <ArrowLeft className="size-4 mr-2" />
          Back to Events
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      
      {/* --- TOP HEADER & BACK LINK --- */}
      <div className="space-y-4">
        <div>
          <Link 
            href="/dashboard/events" 
            className="inline-flex items-center text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            Back to Events
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200/80">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                {eventData.name}
              </h1>
              {isArchived ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
                  Completed
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live / Upcoming
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 mt-1.5">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-neutral-400" />
                {eventData.location}
              </span>
              <span className="text-neutral-300">•</span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5 text-neutral-400" />
                {eventData.startDate} — {eventData.endDate}
              </span>
            </div>
          </div>

          {/* Close Out / End Event Button */}
          <div className="flex items-center gap-3">
            {!isArchived ? (
              <Button 
                onClick={() => {
                  setCloseoutError("");
                  setIsCloseoutOpen(true);
                }}
                disabled={totalCurrentlyDeployed > 0 || !isAdmin}
                variant="outline"
                className={`rounded-xl font-medium border-rose-200 text-rose-700 hover:bg-rose-50 h-10 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <FileSignature className="size-4 mr-1.5" />
                Complete & Close Event
              </Button>
            ) : (
              <span className="text-xs bg-neutral-100 text-neutral-600 px-3 py-1.5 rounded-xl border border-neutral-200 font-medium flex items-center gap-1.5">
                <Lock className="size-3.5" />
                Archived & Sealed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* --- OPERATION METRICS HIGH-LEVEL PANEL --- */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-4`}>
        
        {/* Metric 1: Total Assigned Assets */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Total Assigned Assets</span>
            <h3 className="text-3xl font-bold text-neutral-900 tracking-tight">
              {totalAllocatedAssets}
            </h3>
          </div>
          <div className="size-11 rounded-xl bg-purple-50 border border-purple-100 text-[#800080] flex items-center justify-center shrink-0">
            <Layers className="size-5" />
          </div>
        </div>

        {/* Metric 2: Dispatched On-Site */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Dispatched On-Site</span>
            <h3 className="text-3xl font-bold text-emerald-700 tracking-tight">
              {totalCurrentlyDeployed}
            </h3>
          </div>
          <div className="size-11 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <PackageCheck className="size-5" />
          </div>
        </div>

        {/* Metric 3: Quarantined / Damaged */}
        <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-neutral-500 font-medium">Quarantined / Damaged</span>
            <h3 className="text-3xl font-bold text-rose-600 tracking-tight">
              {totalMissingCounts + totalDamagedCounts}
            </h3>
          </div>
          <div className="size-11 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <TrendingDown className="size-5" />
          </div>
        </div>

        {/* Metric 4: Financial Risk Worth (Strictly Hidden for Staff Role) */}
        {isAdmin && (
          <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs text-neutral-500 font-medium">Financial Risk Worth</span>
              <h3 className="text-3xl font-bold text-amber-700 tracking-tight">
                ₦{totalFinancialRisk.toLocaleString()}
              </h3>
            </div>
            <div className="size-11 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <DollarSign className="size-5" />
            </div>
          </div>
        )}

      </div>

      {/* --- MAIN OPERATIONAL AREA --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT TWO-THIRDS: SCANNERS & FORMS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB SWITCHERS */}
          <div className="bg-neutral-100 p-1 rounded-xl flex">
            <button 
              onClick={() => {
                if (isArchived) return;
                setActiveTab("checkout");
                setMatchedItem(null);
                setScanSkuInput("");
              }}
              disabled={isArchived}
              className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === "checkout" 
                  ? "bg-[#800080] text-white shadow-xs font-semibold" 
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
              }`}
            >
              <PackageCheck className="size-4" />
              Dispatch (Scan-Out)
            </button>
            <button 
              onClick={() => {
                if (isArchived) return;
                setActiveTab("return");
                setActiveReturnItem(null);
                setScanReturnSkuInput("");
              }}
              disabled={isArchived}
              className={`flex-1 py-2.5 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === "return" 
                  ? "bg-[#800080] text-white shadow-xs font-semibold" 
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
              }`}
            >
              <Undo2 className="size-4" />
              Return (Scan-In)
            </button>
          </div>

          {/* READ-ONLY STATE BARRIER IF ARCHIVED */}
          {isArchived && (
            <div className="bg-white border border-neutral-200/80 rounded-xl p-8 text-center shadow-xs space-y-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 mx-auto">
                <Lock className="size-6" />
              </div>
              <h4 className="text-base font-bold text-neutral-900">
                Operational Dashboard Sealed
              </h4>
              <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                This event is completed, approved, and archived. All dispatch and return pipelines are permanently closed.
              </p>
              {eventData.closeoutNotes && (
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 text-left max-w-xl mx-auto space-y-1 mt-4">
                  <span className="text-[11px] text-neutral-500 font-semibold uppercase block flex items-center gap-1.5">
                    <FileSignature className="size-3.5 text-[#800080]" />
                    Closeout Note Records
                  </span>
                  <p className="text-xs text-neutral-700 italic leading-relaxed">
                    "{eventData.closeoutNotes}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB A: SCAN OUT (CHECKOUT) */}
          {!isArchived && activeTab === "checkout" && (
            <div className="bg-white border border-neutral-200/80 rounded-xl p-6 space-y-6 shadow-xs">
              
              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <PackageCheck className="size-5 text-[#800080]" />
                  Dispatch (Scan-Out)
                </h3>
                <p className="text-xs text-neutral-500">
                  Scan asset QR labels or enter SKUs manually to process gear dispatch and return for this event.
                </p>
              </div>

              {/* DUAL INPUT CONTROLS BAR */}
              <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleCheckoutScan} className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                    <Input 
                      type="text" 
                      placeholder="Enter SKU manually or scan barcode (e.g. SPK-JBL-SRX828)..." 
                      value={scanSkuInput}
                      onChange={(e) => setScanSkuInput(e.target.value)}
                      className="bg-neutral-50/60 border-neutral-200 rounded-xl pl-10 pr-4 text-xs h-10 font-mono text-neutral-900 focus-visible:ring-[#800080]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="outline"
                    className="border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl h-10 px-4 text-xs font-medium cursor-pointer"
                  >
                    Lookup
                  </Button>
                </form>

                {/* Camera Scanner Access trigger */}
                <Button 
                  onClick={() => startCameraStream("checkout")}
                  className="bg-[#800080] hover:bg-[#660066] text-white font-medium rounded-xl h-10 px-5 text-xs shadow-xs cursor-pointer"
                >
                  <Camera className="size-4 mr-2" />
                  Scan Live Camera
                </Button>
              </div>

              {/* FEEDBACK FEED */}
              {checkoutError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {checkoutSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{checkoutSuccess}</span>
                </div>
              )}

              {/* BATCH QUANTITY CONFIRMATION CARD */}
              {matchedItem && (
                <div className="bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-5 space-y-5 animate-in zoom-in-95 duration-200">
                  <span className="text-[10px] bg-purple-50 text-[#800080] border border-purple-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-semibold flex items-center w-fit gap-1.5">
                    <Sparkles className="size-3" />
                    Asset Match Resolved
                  </span>

                  {/* Asset Details */}
                  <div className="grid grid-cols-2 gap-4 border-b border-neutral-200/80 pb-4">
                    <div>
                      <span className="text-[11px] text-neutral-500 font-medium block">Asset Name</span>
                      <strong className="text-neutral-900 text-sm block mt-0.5 font-bold">{matchedItem.name}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-500 font-medium block">SKU Code</span>
                      <code className="text-xs font-mono font-bold text-[#800080] bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded-md inline-block mt-0.5">
                        {matchedItem.sku}
                      </code>
                    </div>
                  </div>

                  {/* Balance levels */}
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-neutral-200 flex flex-col justify-between">
                      <span className="text-[11px] text-neutral-500 font-medium">Warehouse Stock:</span>
                      <strong className="text-emerald-700 font-bold mt-1 text-sm">{matchedItem.warehouseQty}</strong>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-neutral-200 flex flex-col justify-between">
                      <span className="text-[11px] text-neutral-500 font-medium">UOM:</span>
                      <span className="text-neutral-900 uppercase font-bold mt-1">{matchedItem.unitOfMeasure}</span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-neutral-200 flex flex-col justify-between">
                      <span className="text-[11px] text-neutral-500 font-medium">Value (₦):</span>
                      <span className="text-neutral-900 font-bold mt-1">₦{matchedItem.replacementValue.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Action inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* Batch Qty input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 block">Dispatch Quantity</label>
                      <Input 
                        ref={checkoutQtyInputRef}
                        type="number" 
                        min="1" 
                        max={matchedItem.warehouseQty}
                        value={checkoutQty}
                        onChange={(e) => setCheckoutQty(e.target.value)}
                        className="bg-white border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                      />
                    </div>

                    {/* Snapshot file upload */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 block flex items-center gap-1">
                        <Upload className="size-3.5 text-neutral-400" />
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
                          className="w-full bg-white border border-neutral-200 hover:bg-neutral-50 rounded-xl px-3 h-10 text-xs text-neutral-500 hover:text-neutral-900 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <span className="truncate max-w-[80%] font-mono">
                            {checkoutSnapshot ? checkoutSnapshot.name : "Select Snapshot (Optional)..."}
                          </span>
                          <FileImage className="size-4 text-neutral-400 shrink-0" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* SCAN-OUT CONFIRMATION TRIGGER */}
                  <div className="pt-2 border-t border-neutral-200/80">
                    <Button 
                      onClick={handleConfirmCheckout}
                      disabled={submittingCheckout}
                      className="w-full bg-[#800080] hover:bg-[#660066] text-white font-medium rounded-xl h-10 shadow-xs cursor-pointer"
                    >
                      {submittingCheckout ? (
                        <>
                          <RefreshCw className="size-4 mr-2 animate-spin text-white" />
                          Allocating Assets...
                        </>
                      ) : (
                        <>
                          Confirm Dispatch to {eventData.name}
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
            <div className="bg-white border border-neutral-200/80 rounded-xl p-6 space-y-6 shadow-xs">

              <div className="space-y-1">
                <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Undo2 className="size-5 text-[#800080]" />
                  Return (Scan-In)
                </h3>
                <p className="text-xs text-neutral-500">
                  Scan returning barcodes or select checked-out gear from the table to log return baselines.
                </p>
              </div>

              {/* DUAL INPUT CONTROLS BAR */}
              <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleReturnScanInput} className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                    <Input 
                      type="text" 
                      placeholder="Scan returning item SKU or ID code..." 
                      value={scanReturnSkuInput}
                      onChange={(e) => setScanReturnSkuInput(e.target.value)}
                      className="bg-neutral-50/60 border-neutral-200 rounded-xl pl-10 pr-4 text-xs h-10 font-mono text-neutral-900 focus-visible:ring-[#800080]"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="outline"
                    className="border-neutral-200 hover:bg-neutral-100 text-neutral-700 rounded-xl h-10 px-4 text-xs font-medium cursor-pointer"
                  >
                    Lookup
                  </Button>
                </form>

                {/* Live camera scan trigger */}
                <Button 
                  onClick={() => startCameraStream("return")}
                  className="bg-[#800080] hover:bg-[#660066] text-white font-medium rounded-xl h-10 px-5 text-xs shadow-xs cursor-pointer"
                >
                  <Camera className="size-4 mr-2" />
                  Scan Live Camera
                </Button>
              </div>

              {/* SCAN-IN SAFETY GATE MISMATCH FEEDBACK */}
              {returnMismatchedAlert && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-xs flex items-start gap-3 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5 text-rose-600" />
                  <div className="space-y-1">
                    <span className="font-bold block">Asset mismatch: Return locked.</span>
                    <span className="text-rose-600/90 block">{returnMismatchedAlert}</span>
                  </div>
                </div>
              )}

              {returnSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <CheckCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{returnSuccess}</span>
                </div>
              )}

              {/* CONFIRMATION RETURN FORM CARD */}
              {activeReturnItem && (
                <form onSubmit={handleConfirmReturnSubmit} className="bg-neutral-50/70 border border-neutral-200/80 rounded-xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-neutral-200/80 pb-3">
                    <span className="text-xs font-bold text-neutral-900 block">
                      Process Return Checklist: {activeReturnItem.sku}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setActiveReturnItem(null);
                        setReturnMismatchedAlert("");
                      }}
                      className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Return item name */}
                  <div className="text-xs">
                    <span className="text-neutral-500">Asset:</span> <strong className="text-neutral-900">{activeReturnItem.name}</strong>
                  </div>

                  {/* Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Returning Quantity */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 block">Returning Quantity</label>
                      <Input 
                        ref={returnQtyInputRef}
                        type="number" 
                        min="1" 
                        value={returnQty}
                        onChange={(e) => setReturnQty(e.target.value)}
                        className="bg-white border-neutral-200 rounded-xl h-10 text-xs focus-visible:ring-[#800080]"
                      />
                    </div>

                    {/* Condition Picker */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-700 block">Evaluated Condition</label>
                      <select 
                        value={returnCondition}
                        onChange={(e) => setReturnCondition(e.target.value as any)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 h-10 text-xs text-neutral-800 outline-none focus:border-[#800080] cursor-pointer"
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
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4 animate-in slide-in-from-top-2">
                          <div className="flex items-start gap-2.5 text-xs text-amber-900 font-medium leading-relaxed">
                            <Lock className="size-4 shrink-0 mt-0.5 text-amber-700" />
                            <div className="space-y-1">
                              <span className="block font-bold text-amber-800">DISCREPANCY DETECTED — SUBMIT LOCKED</span>
                              <p className="text-amber-800/90 text-xs">
                                {isShort && `Deficit detected: Checking in only ${parsedQty} out of ${currentlyCheckedOut} allocated items. `}
                                {isDamaged && `Baseline condition is Damaged. `}
                                You must supply detailed text damage/loss descriptions and attach a damage/loss photograph file to unlock submission.
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-amber-200/60">
                            {/* Required discrepancy text notes */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-amber-900 uppercase">Text Damage / Loss Descriptions *</label>
                              <textarea 
                                required
                                value={returnNote}
                                onChange={(e) => setReturnNote(e.target.value)}
                                placeholder="State exact locations of damages, missing items reasons, or notes..."
                                className="w-full bg-white border border-amber-300 focus:border-amber-500 rounded-xl p-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none min-h-[60px]"
                              />
                            </div>

                            {/* Required damage file upload */}
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-bold text-amber-900 uppercase">Damage / Loss Photo Snapshot *</label>
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
                                  className="w-full bg-white border border-amber-300 hover:bg-amber-100/50 rounded-xl p-2.5 text-xs text-neutral-600 hover:text-neutral-900 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                  <span className="truncate max-w-[80%] font-mono">
                                    {returnPhoto ? returnPhoto.name : "Select photo to upload..."}
                                  </span>
                                  <FileImage className="size-4 text-amber-700 shrink-0" />
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
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      <span>{returnError}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-neutral-200/80 flex gap-3">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => setActiveReturnItem(null)}
                      className="flex-1 border-neutral-200 text-neutral-700 rounded-xl h-10"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      disabled={submittingReturn || isReturnLocked()}
                      className="flex-1 bg-[#800080] hover:bg-[#660066] text-white font-medium rounded-xl h-10 shadow-xs disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    >
                      {submittingReturn ? (
                        <>
                          <RefreshCw className="size-4 mr-2 animate-spin text-white" />
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
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Allocated Gear Deployment Checklist
                </h4>

                {deployedItemsList.length === 0 ? (
                  <div className="bg-neutral-50 border border-neutral-200/80 rounded-xl py-8 px-4 text-center text-xs text-neutral-500">
                    All checkouts are accounted for. No gear currently deployed.
                  </div>
                ) : (
                  <div className="border border-neutral-200/80 rounded-xl overflow-hidden divide-y divide-neutral-200/80 bg-white text-xs">
                    {deployedItemsList.map((item) => (
                      <div key={item.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/60 transition-colors">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-[#800080] bg-purple-50 border border-purple-200/80 px-2 py-0.5 rounded">
                              {item.sku}
                            </span>
                            <strong className="text-neutral-900 font-semibold">{item.name}</strong>
                          </div>
                          <div className="text-neutral-500 text-[11px]">
                            Checked-out: <strong className="text-neutral-800">{item.qtyCheckedOut}</strong> | Returned: <strong className="text-emerald-700">{item.qtyReturned}</strong> | Damaged: <strong className="text-rose-600">{item.qtyDamaged}</strong> | Missing: <strong className="text-amber-600">{item.qtyMissing}</strong> | Active: <strong className="text-[#800080]">{item.remainingCheckedOut}</strong>
                          </div>
                        </div>
                        <Button 
                          onClick={() => {
                            setReturnQty(item.remainingCheckedOut.toString());
                            setActiveReturnItem(item);
                            setReturnMismatchedAlert("");
                          }}
                          size="xs"
                          variant="outline"
                          className="border-neutral-200 text-neutral-700 hover:text-[#800080] hover:bg-neutral-50 shrink-0 font-semibold text-xs rounded-lg cursor-pointer"
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

        {/* RIGHT COLUMN: EVENT ACTIVITY STREAM */}
        <div className="space-y-6">
          
          <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-xs flex flex-col justify-between">
            
            <div className="space-y-1 pb-4 border-b border-neutral-200/80">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <FileText className="size-4 text-[#800080]" />
                Event Activity Stream
              </h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Real-time log of equipment check-outs, returns, and condition notes for this production.
              </p>
            </div>

            {/* Logs activity lists */}
            <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {activityLogs.length === 0 ? (
                <div className="py-16 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                  <Activity className="size-8 text-neutral-300" />
                  <span>No activity logged for this event yet. Use the scan inputs on the left to check out equipment.</span>
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-3.5 bg-neutral-50/70 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 flex flex-col justify-between gap-2.5 text-xs transition-colors"
                  >
                    {/* Log header */}
                    <div className="flex justify-between items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        log.actionType === "CHECKOUT"
                          ? "bg-purple-50 text-[#800080] border-purple-200/80"
                          : log.actionType === "RETURN"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {log.actionType === "CHECKOUT" ? "Dispatch" : log.actionType === "RETURN" ? "Return" : "Audit Correction"}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono bg-white px-2 py-0.5 rounded border border-neutral-200/60">
                        {new Date(log.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    {/* Operator Tracing output */}
                    <div className="space-y-1 text-neutral-700">
                      <div>
                        Asset SKU: <strong className="text-neutral-900 font-bold font-mono text-[#800080]">{log.itemSku}</strong>
                      </div>
                      <div className="font-semibold text-neutral-900 text-xs">{log.itemName}</div>
                      
                      {/* Operator signature */}
                      <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                        <UserCheck className="size-3.5 text-neutral-400 shrink-0" />
                        <span>
                          {log.quantity} {log.quantity === 1 ? "unit" : "units"} {log.actionType.toLowerCase() === "checkout" ? "checked out" : log.actionType.toLowerCase() === "return" ? "returned" : "reversed"} by{" "}
                          <strong className="text-neutral-800 font-medium">{log.actionedByName || "Operator"}</strong>
                        </span>
                      </div>
                      
                      {log.note && (
                        <p className="text-[11px] italic text-neutral-600 bg-white p-2 rounded-lg border border-neutral-200/80 mt-1 leading-relaxed">
                          Note: {log.note}
                        </p>
                      )}

                      {/* IN-APP IMAGE DIALOG MODAL VIEW TRIGGER */}
                      {log.snapshotUrl && (
                        <button 
                          onClick={() => setActiveZoomUrl(log.snapshotUrl || null)}
                          className="text-[11px] text-[#800080] hover:text-[#660066] font-medium transition-colors flex items-center gap-1 mt-1 bg-transparent border-none cursor-pointer"
                        >
                          <FileImage className="size-3.5" />
                          View Snapshot Proof
                        </button>
                      )}
                    </div>

                    {/* Admin Undo Button (reversal pipeline) */}
                    {log.actionType !== "AUDIT_CORRECTION" && !isArchived && (
                      <div className="pt-2 border-t border-neutral-200/80 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ID: #{log.id.slice(-5)}
                        </span>
                        
                        <Button 
                          onClick={() => handleUndoTransaction(log)}
                          disabled={reversingId !== null || !isAdmin}
                          size="xs"
                          variant="ghost"
                          className="h-7 text-neutral-600 hover:text-amber-700 hover:bg-amber-50 text-[11px] font-medium shrink-0 cursor-pointer"
                        >
                          {reversingId === log.id ? (
                            <RefreshCw className="size-3 animate-spin mr-1 text-amber-600" />
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

      </div>

      {/* --- 1. DEVICE CAMERA SCANNER DIALOG MODAL --- */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/40 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-xl w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-[#800080]" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Live Barcode & QR Scanner
                </h3>
              </div>
              <button 
                onClick={stopCameraStream}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Secure context warning banner */}
            {!isSecureContext && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-xs flex items-start gap-2.5 mx-6 mt-4 rounded-xl animate-in slide-in-from-top-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-700" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Insecure Connection Warning</span>
                  <p className="text-xs text-amber-800/80">
                    Webcam scanning requires an HTTPS connection or localhost to operate securely.
                  </p>
                </div>
              </div>
            )}

            {/* Video Viewport & Scanning Overlay */}
            <div className="p-6 space-y-5">
              <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 shadow-inner flex items-center justify-center">
                
                {/* Sweep laser line animation */}
                <div className="absolute inset-0 border-2 border-purple-400/30 m-6 rounded-lg pointer-events-none flex items-center justify-center">
                  <div className="w-[80%] h-[2px] bg-gradient-to-r from-transparent via-[#ffd700] to-transparent shadow-[0_0_10px_#ffd700] animate-pulse" />
                </div>

                <video 
                  ref={videoRef}
                  autoPlay={true}
                  playsInline={true}
                  className="w-full h-full object-cover"
                />

                {/* If stream failed */}
                {(!activeCameraStream || cameraErrorMsg) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 space-y-2 bg-neutral-900/90 z-20">
                    <AlertTriangle className="size-8 text-amber-400 animate-bounce" />
                    <span className="text-xs text-white font-bold">Live Camera Feed Unavailable</span>
                    <p className="text-xs text-neutral-300 max-w-xs">
                      {cameraErrorMsg || "Webcam scanning requires an HTTPS connection or localhost to operate securely."}
                    </p>
                    <p className="text-xs text-[#ffd700] font-semibold max-w-xs pt-1.5">
                      You can click any of the simulation targets below to test barcode/QR scans.
                    </p>
                  </div>
                )}
              </div>

              {/* SIMULATOR CLICK OPTIONS */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-neutral-500 tracking-wider block">
                  Scan Simulation Targets (Click to Scan):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[140px] overflow-y-auto pr-1">
                  {inventoryList.map((item) => (
                    <button 
                      key={item.id}
                      type="button"
                      onClick={() => handleSimulateScan(item)}
                      className="p-2 bg-neutral-50 hover:bg-purple-50 border border-neutral-200 hover:border-purple-200 rounded-lg text-xs text-neutral-700 hover:text-[#800080] font-mono text-left font-medium transition-all truncate cursor-pointer"
                    >
                      [{item.sku}] {item.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Close */}
              <div className="border-t border-neutral-200/80 pt-4">
                <Button 
                  onClick={stopCameraStream}
                  variant="outline"
                  className="w-full border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-xl font-medium h-10"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/50 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-3xl w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                <FileImage className="size-4 text-[#800080]" />
                Snapshot Verification Proof Image
              </span>
              <button 
                onClick={() => setActiveZoomUrl(null)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Image viewport */}
            <div className="p-4 bg-neutral-100 flex items-center justify-center aspect-video relative">
              <img 
                src={activeZoomUrl} 
                alt="Verification Proof" 
                className="max-h-[500px] object-contain rounded-lg shadow-sm"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-neutral-200/80 bg-neutral-50/50 flex justify-end">
              <Button 
                onClick={() => setActiveZoomUrl(null)}
                variant="outline"
                className="border-neutral-200 text-neutral-700 hover:bg-neutral-100 font-medium h-9 text-xs rounded-xl"
              >
                Close View
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- 3. CLOSE OUT EVENT LIFECYCLE MODAL --- */}
      {isCloseoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs bg-black/40 transition-all duration-300 animate-in fade-in">
          <div className="relative max-w-md w-full bg-white border border-neutral-200/80 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSignature className="size-5 text-rose-600" />
                <h3 className="text-sm font-bold text-neutral-900">
                  Complete & Close Event
                </h3>
              </div>
              <button 
                onClick={() => setIsCloseoutOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCloseoutSubmit} className="p-6 space-y-4">
              
              <div className="text-xs text-neutral-600 leading-relaxed">
                You are about to close out, archive, and seal the event <strong className="text-neutral-900">"{eventData.name}"</strong>. This will freeze all allocations and active operations.
              </div>

              {/* Warnings details if discrepancy exists */}
              {totalMissingCounts + totalDamagedCounts > 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-amber-900 font-bold">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-700" />
                    <span>OUTSTANDING DISCREPANCIES RECORDED</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-normal">
                    This event has <strong className="text-neutral-900">{totalMissingCounts} lost</strong> and <strong className="text-neutral-900">{totalDamagedCounts} damaged</strong> items, causing an estimated financial risk impact of <strong className="text-neutral-900">₦{totalFinancialRisk.toLocaleString()}</strong>.
                  </p>
                  
                  {/* Notes input */}
                  <div className="space-y-1.5 pt-2 border-t border-amber-200">
                    <label className="text-[11px] font-bold text-amber-900 uppercase">Discrepancy Resolution Note *</label>
                    <textarea 
                      required
                      value={closeoutNotesInput}
                      onChange={(e) => setCloseoutNotesInput(e.target.value)}
                      placeholder="Detail insurance reports, claims actions, client billing terms, or loss approvals..."
                      className="w-full bg-white border border-amber-300 focus:border-amber-500 rounded-xl p-2.5 text-xs text-neutral-900 placeholder:text-neutral-400 outline-none min-h-[80px]"
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs flex items-center gap-2.5 font-semibold">
                  <ShieldCheck className="size-5 text-emerald-600 shrink-0" />
                  <span>Clean closeout: 100% of equipment successfully returned intact.</span>
                </div>
              )}

              {closeoutError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs flex items-start gap-2 animate-in slide-in-from-top-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{closeoutError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex gap-3 border-t border-neutral-200/80">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setIsCloseoutOpen(false)}
                  disabled={submittingCloseout}
                  className="flex-1 border-neutral-200 text-neutral-700 hover:bg-neutral-100 h-10 rounded-xl font-medium"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={submittingCloseout}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl h-10 shadow-xs cursor-pointer"
                >
                  {submittingCloseout ? (
                    <RefreshCw className="size-4 animate-spin text-white" />
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
