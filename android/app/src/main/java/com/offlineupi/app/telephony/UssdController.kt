package com.offlineupi.app.telephony

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import android.widget.Toast

object UssdController {

    const val NPCI_USSD_MAIN = "*99#"
    const val NPCI_USSD_SEND_MOBILE = "*99*1*1#"
    const val NPCI_USSD_SEND_UPI = "*99*1*2#"
    const val NPCI_USSD_CHECK_BALANCE = "*99*3#"
    const val NPCI_USSD_MINI_STATEMENT = "*99*7#"
    const val UPI_123PAY_IVR_NUMBER = "08045163666"

    /**
     * Dials a USSD MMI string using the native Android Telephony intent.
     * Note: Uri.encode() is required so that '#' is encoded as '%23',
     * preventing Android from stripping it as a URI fragment.
     */
    fun dialUssd(context: Context, mmiCode: String) {
        try {
            val encodedCode = Uri.encode(mmiCode)
            val callIntent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$encodedCode")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(callIntent)
        } catch (e: SecurityException) {
            Toast.makeText(context, "Call Phone permission required to dial USSD", Toast.LENGTH_LONG).show()
        } catch (e: Exception) {
            Toast.makeText(context, "Error initiating USSD: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Dials the official UPI 123PAY Toll-free Voice IVR line.
     */
    fun call123PayIvr(context: Context, number: String = UPI_123PAY_IVR_NUMBER) {
        try {
            val callIntent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$number")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(callIntent)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not place voice call: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Programmatic USSD invocation via TelephonyManager (Android 8.0+ / API 26).
     * Works when carrier firmware supports direct USSD callbacks.
     */
    fun sendUssdRequestDirect(
        context: Context,
        mmiCode: String,
        onResponse: (CharSequence) -> Unit,
        onFailure: (Int) -> Unit
    ) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
            if (telephonyManager == null) {
                onFailure(-1)
                return
            }

            try {
                telephonyManager.sendUssdRequest(
                    mmiCode,
                    object : TelephonyManager.UssdResponseCallback() {
                        override fun onReceiveUssdResponse(
                            telephonyManager: TelephonyManager,
                            request: String,
                            response: CharSequence
                        ) {
                            super.onReceiveUssdResponse(telephonyManager, request, response)
                            onResponse(response)
                        }

                        override fun onReceiveUssdResponseFailed(
                            telephonyManager: TelephonyManager,
                            request: String,
                            failureCode: Int
                        ) {
                            super.onReceiveUssdResponseFailed(telephonyManager, request, failureCode)
                            onFailure(failureCode)
                        }
                    },
                    Handler(Looper.getMainLooper())
                )
            } catch (e: SecurityException) {
                onFailure(-2)
            }
        } else {
            // Fallback to dial intent on older Android releases
            dialUssd(context, mmiCode)
        }
    }
}
