package com.offlineupi.app.data

import android.content.Context
import android.content.SharedPreferences

data class OfflineBeneficiary(
    val id: String,
    val name: String,
    val phoneOrUpi: String,
    val isPhone: Boolean = true,
    val category: String = "Personal"
) {
    fun getUssdCode(): String {
        return if (isPhone) {
            "*99*1*1#"
        } else {
            "*99*1*2#"
        }
    }
}

class OfflineStorage(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("offline_upi_prefs", Context.MODE_PRIVATE)

    companion object {
        val DEFAULT_CONTACTS = listOf(
            OfflineBeneficiary("1", "Sharma Chai Stall", "9988776655", isPhone = true, category = "Tea & Snacks"),
            OfflineBeneficiary("2", "Ramesh Kirana Store", "9876543210", isPhone = true, category = "Groceries"),
            OfflineBeneficiary("3", "Pooja Sharma", "pooja@paytm", isPhone = false, category = "Roommate"),
            OfflineBeneficiary("4", "City Auto Rickshaw", "9711223344", isPhone = true, category = "Transport")
        )
    }

    fun getBeneficiaries(): List<OfflineBeneficiary> {
        val raw = prefs.getString("contacts_csv", null) ?: return DEFAULT_CONTACTS
        return raw.split(";").mapNotNull { entry ->
            val parts = entry.split("|")
            if (parts.size >= 4) {
                OfflineBeneficiary(
                    id = parts[0],
                    name = parts[1],
                    phoneOrUpi = parts[2],
                    isPhone = parts[3].toBoolean()
                )
            } else null
        }
    }

    fun saveBeneficiary(contact: OfflineBeneficiary) {
        val existing = getBeneficiaries().toMutableList()
        existing.add(contact)
        val serialized = existing.joinToString(";") { "${it.id}|${it.name}|${it.phoneOrUpi}|${it.isPhone}" }
        prefs.edit().putString("contacts_csv", serialized).apply()
    }
}
