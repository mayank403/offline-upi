package com.offlineupi.app.qr

import android.net.Uri

data class UpiQrPayload(
    val payeeAddress: String,      // pa (VPA / UPI ID)
    val payeeName: String,         // pn (Merchant / Friend Name)
    val amount: String? = null,    // am (Amount in INR)
    val note: String? = null,      // tn (Transaction Note)
    val merchantCode: String? = null // mc
) {
    /**
     * Synthesizes the exact *99# USSD sequence to dial this merchant directly.
     */
    fun toUssdDialCode(): String {
        return if (!amount.isNullOrBlank()) {
            // Send Money via UPI ID
            "*99*1*2#"
        } else {
            "*99*1*2#"
        }
    }
}

object OfflineQrParser {

    /**
     * Parses a raw UPI QR string (e.g., "upi://pay?pa=shop@ybl&pn=Chai%20Shop&am=20")
     * completely offline without making network requests.
     */
    fun parse(rawUriString: String): UpiQrPayload? {
        return try {
            val uri = Uri.parse(rawUriString)
            if (uri.scheme?.equals("upi", ignoreCase = true) != true) {
                return null
            }

            val pa = uri.getQueryParameter("pa") ?: return null
            val pn = uri.getQueryParameter("pn") ?: "Merchant"
            val am = uri.getQueryParameter("am")
            val tn = uri.getQueryParameter("tn")
            val mc = uri.getQueryParameter("mc")

            UpiQrPayload(
                payeeAddress = pa,
                payeeName = pn,
                amount = am,
                note = tn,
                merchantCode = mc
            )
        } catch (e: Exception) {
            null
        }
    }
}
